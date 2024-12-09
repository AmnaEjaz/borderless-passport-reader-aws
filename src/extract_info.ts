import { SQSEvent } from 'aws-lambda';
import { Textract, SQS } from 'aws-sdk';

const textract = new Textract();
const { BUCKET_NAME, PROCESSED_PAYLOAD_QUEUE_URL, PROCESSED_PAYLOAD_SOCKET_QUEUE } = process.env;

const sqs = new SQS();
/**
 * Processes SQS events and extracts information from documents using Textract.
 * Sends extracted information to both the processed payload queue and the processed payload socket queue.
 * @param {SQSEvent} event - The SQS event containing the messages to be processed.
 * @returns {Promise<void>} - A promise that resolves when the processing is complete.
 */

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log('Message Received, extract_info Lambda Triggered');
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      const socketId = message.socketId;
      const filename = message.filename;
      const s3Location = message.s3Location;
      const key = decodeURIComponent(message.filename.replace(/\+/g, ' '));

      if (!filename) {
        console.error('No filename found in the SQS message');
        continue;
      }
      console.log('Processing file:', filename);
      const analyzeParams: Textract.AnalyzeIDRequest = {
        DocumentPages: [
          {
            S3Object: {
              Bucket: BUCKET_NAME,
              Name: key,
            },
          },
        ],
      };

      const analyzeResult = await textract.analyzeID(analyzeParams).promise();
      const extractedFields = extractFieldsFromAnalyzeIDResponse(analyzeResult);

      if (!extractedFields.dateOfBirth && !extractedFields.expiryDate) {
        console.error('Date of birth or expiry date not found in the document');

        await sendMessageToSQS(
          JSON.stringify({
            fields: extractedFields,
            socketId,
          }),
          PROCESSED_PAYLOAD_SOCKET_QUEUE!
        );

        console.log('Message sent to SQS');
        continue;
      } else {
        console.log('Date of birth or expiry date extracted successfully');
        try {
          await sendMessageToSQS(
            JSON.stringify({
              fields: extractedFields,
              filename,
              s3Location,
              processedAt: new Date(),
            }),
            PROCESSED_PAYLOAD_QUEUE_URL!
          );

          await sendMessageToSQS(
            JSON.stringify({
              fields: extractedFields,
              socketId,
            }),
            PROCESSED_PAYLOAD_SOCKET_QUEUE!
          );

          console.log('Message sent to SQS');
        } catch (error) {
          console.error('Error sending message:', error);
        }
      }
    } catch (error) {
      console.error('Error processing S3 event:', error);
    }
  }
};

/**
 * Extracts fields such as date of birth and expiry date from the Textract AnalyzeID response.
 * @param {Textract.AnalyzeIDResponse} response - The response from the Textract AnalyzeID operation.
 * @returns {object} - The extracted fields.
 */
const extractFieldsFromAnalyzeIDResponse = (response: Textract.AnalyzeIDResponse): { [key: string]: string } => {
  const extractedFields: { [key: string]: string } = {};

  response.IdentityDocuments?.forEach(document => {
    document.IdentityDocumentFields?.forEach(field => {
      if (field.Type?.Text === 'DATE_OF_BIRTH') {
        extractedFields.dateOfBirth = field.ValueDetection?.Text || '';
      } else if (field.Type?.Text === 'EXPIRATION_DATE') {
        extractedFields.expiryDate = field.ValueDetection?.Text || '';
      }
    });
  });

  return extractedFields;
};

const sendMessageToSQS = async (messageBody: string, queueUrl: string): Promise<void> => {
  try {
    const sqsParams = {
      QueueUrl: queueUrl,
      MessageBody: messageBody,
    };

    await sqs.sendMessage(sqsParams).promise();

    console.log('Message sent to SQS');
  } catch (error) {
    console.error('Error sending message:', error);
  }
};
