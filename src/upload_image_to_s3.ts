import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3, SQS } from 'aws-sdk';
import * as multipart from 'parse-multipart';

const s3 = new S3();
const sqs = new SQS();
const { BUCKET_NAME, PAYLOAD_QUEUE_URL } = process.env;

/**
 * Uploads an image to Amazon S3 and sends a message to an SQS queue.
 * @param event - The API Gateway proxy event.
 * @returns The API Gateway proxy result.
 */

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Upload Image Lambda Triggered');
  try {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Content-Type must be multipart/form-data',
          receivedContentType: contentType,
        }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing body' }),
      };
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'No boundary found in content type',
          contentType,
        }),
      };
    }

    const bodyBuffer = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body);
    const parts = multipart.Parse(bodyBuffer, boundary);
    const file = parts.find(part => part.filename);

    if (!file) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'No file uploaded',
          partsFound: parts.length,
          partTypes: parts.map(p => p.type),
        }),
      };
    }

    console.log('Uploading file:', file.filename);

    const uploadResult = await s3
      .upload({
        Bucket: BUCKET_NAME!,
        Key: `${file.filename}`,
        Body: file.data,
        ContentType: file.type,
      })
      .promise();

    console.log('Upload successful');

    const socketId = Math.random().toString(36).substring(2, 6);
    try {
      const sqsParams = {
        QueueUrl: PAYLOAD_QUEUE_URL!,
        MessageBody: JSON.stringify({
          socketId,
          s3Location: uploadResult.Location,
          filename: file.filename,
        }),
      };

      await sqs.sendMessage(sqsParams).promise();
      console.log('Message sent to SQS');
    } catch (error) {
      console.error('Error sending message:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error sending message to queue',
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'File uploaded successfully',
        socketId,
      }),
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error uploading file',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
