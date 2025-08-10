import { Pool } from 'pg';

// Database connection pool
const pool = new Pool({
  user: "shafin",          // Replace with your database username
  host: "localhost",       // Use your database host if different
  database: "mydb2",       // Replace with your database name
  password: "1234",        // Replace with your database password
  port: 5432,              // Replace with your database port if necessary
});

// Function to query the database
async function queryDatabase(query, params = []) {
  try {
    const res = await pool.query(query, params);
    return res.rows;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
}

// Export the queryDatabase function for use in other files
export { queryDatabase };
