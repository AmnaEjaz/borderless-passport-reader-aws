import { SQSEvent, SQSRecord } from 'aws-lambda';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
});

/**
 * This function processes a message received from an SQS queue and inserts the data into a PostgreSQL database.
 * It performs the following steps:
 * 1. Establishes a connection to the database using the provided configuration.
 * 2. Tests the database connection by executing a sample query.
 * 3. Calls the `processMessage` function to handle the message.
 * 4. If any error occurs during the process, it logs the error and throws it.
 *
 * @param event - The SQS event containing the message to be processed.
 * @returns A Promise that resolves to void.
 */

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log('Message Received: add_to_db Lambda Triggered');
  try {
    console.log('Attempting database connection...');
    const client = await pool.connect();
    console.log('Successfully acquired client');

    try {
      console.log('Testing query...');
      const testResult = await client.query('SELECT NOW()');
      console.log('Query successful:', testResult.rows[0]);
    } finally {
      console.log('Releasing client');
      client.release();
    }
    event.Records.forEach(async record => await processMessage(record));
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

async function processMessage(record: SQSRecord): Promise<void> {
  const body = JSON.parse(record.body);
  const { fields, filename, s3Location, processedAt } = body;
  console.log('Storing date for file:', filename);
  try {
    // Test database connection again at message level
    const timeResult = await pool.query('SELECT NOW() as current_time');
    console.log('Database time check:', timeResult.rows[0].current_time);

    // Insert hardcoded record
    const query = `
            INSERT INTO processed_images (
                image_name,
                s3_url,
                date_of_birth,
                expiry_date,
                processed_at,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

    const values = [filename, s3Location, fields.dateOfBirth, fields.expiryDate, processedAt, new Date()];

    await pool.query(query, values);
    console.log('Record inserted successfully');
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}
