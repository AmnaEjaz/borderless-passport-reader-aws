# **borderless-passport-reader**

This project is the backend for a passport reading application built using AWS services. It processes passport images, extracts important information like the date of birth (DOB) and expiry date, and stores it in a Postgres database. 

## **Overview**

This backend utilizes AWS Lambda, S3, SQS, AWS Textract, WebSockets, and Postgres to perform the following operations:

1. **Upload Passport Image**: The user uploads an image to the frontend application built with React.js.
2. **Upload Image to S3**: The image is uploaded to an S3 bucket via a Lambda function.
3. **Extract Information**: The Lambda function processes the uploaded image with AWS Textract to extract the DOB and expiry date from the passport.
4. **Queueing**: The extracted data is passed through SQS queues to maintain a decoupled and scalable system. This design helps control throughput and reduces the load on the database, making the flow architecture more robust and easier to backup.
5. **Real-time Updates**: A WebSocket connection is added to send the extracted passport information to the frontend as soon as it is available, providing a real-time user experience.
6. **Insert into Database**: The extracted information is inserted into a Postgres database via another Lambda function.

---

## **Flow Diagram**

![Flow Diagram](./flow.jpeg)

---

## **Architecture**

- **Frontend**: [`passport-uploader`](https://github.com/AmnaEjaz/passport-uploader) built on React.js
- **Backend**: `border-passport-reader` built on TypeScript, deployed using the AWS Serverless Framework
- **AWS Services**:
  - **AWS Lambda**: Handles the core logic and workflows
  - **AWS S3**: Stores the uploaded passport images
  - **AWS SQS**: Handles the queuing of image processing tasks, ensuring the system can control throughput, reduce load on the database, and support efficient backups.
  - **AWS Textract**: Extracts DOB and expiry date from the passport image
  - **WebSockets**: Provides a real-time connection between the backend and frontend, ensuring users receive the extracted data as soon as it's processed.
  - **Postgres**: Stores the extracted information for later retrieval

---

## **Installation and Setup**

### **Prerequisites**
- AWS account with necessary permissions
- Node.js and NPM installed
- Serverless Framework installed

### **Setup**

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/borderless-passport-reader.git
   cd borderless-passport-reader
