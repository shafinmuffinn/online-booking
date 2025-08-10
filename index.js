import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import session from "express-session";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";


import pg from "pg";
const { Pool } = pg;

const costMatrix = {
  Dhaka:      { Dhaka: 1, Chattogram: 5, Khulna: 4, Rajshahi: 4, Rangpur: 5, Mymensingh: 3, Sylhet: 4, Barishal: 4 },
  Chattogram: { Dhaka: 5, Chattogram: 1, Khulna: 5, Rajshahi: 5, Rangpur: 5, Mymensingh: 5, Sylhet: 5, Barishal: 3 },
  Khulna:     { Dhaka: 4, Chattogram: 5, Khulna: 1, Rajshahi: 3, Rangpur: 5, Mymensingh: 5, Sylhet: 5, Barishal: 3 },
  Rajshahi:   { Dhaka: 4, Chattogram: 5, Khulna: 3, Rajshahi: 1, Rangpur: 3, Mymensingh: 5, Sylhet: 5, Barishal: 5 },
  Rangpur:    { Dhaka: 5, Chattogram: 5, Khulna: 5, Rajshahi: 3, Rangpur: 1, Mymensingh: 5, Sylhet: 5, Barishal: 5 },
  Mymensingh: { Dhaka: 3, Chattogram: 5, Khulna: 5, Rajshahi: 5, Rangpur: 5, Mymensingh: 1, Sylhet: 3, Barishal: 5 },
  Sylhet:     { Dhaka: 4, Chattogram: 5, Khulna: 5, Rajshahi: 5, Rangpur: 5, Mymensingh: 3, Sylhet: 1, Barishal: 5 },
  Barishal:   { Dhaka: 4, Chattogram: 3, Khulna: 3, Rajshahi: 5, Rangpur: 5, Mymensingh: 5, Sylhet: 5, Barishal: 1 }
};

const pool = new Pool({
  user: "shafin",
  host: "localhost",
  database: "mydb2",
  password: "1234",
  port: 5432,
});


const app = express();
const port = 1359;

// For __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files (HTML, CSS, JS) from public/
app.use(express.static(path.join(__dirname, "public")));


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: "secretkey", // Replace with a strong secret in production
  resave: true,
  saveUninitialized: false,
}));


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

app.get('/api/divisions', (req, res) => {
  res.json(Object.keys(costMatrix));
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
      [name, email, hashedPassword]
    );
    res.send("Registration successful. You can now login.");
  } catch (err) {
    console.error(err);
    res.send("Error registering user (maybe email already used).");
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(email)
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];

    if (!user) return res.send("User not found");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Invalid credentials");

    req.session.userId = user.id;
    res.redirect("/dashboard.html");

  } catch (err) {
    console.error(err);
    res.send("Error logging in");
  }
});
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login.html");
  }
  next();
}

app.get("/dashboard.html", requireLogin, (req, res) => {
  // static file will be served from public/, but protection happens here
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/api/me", requireLogin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email FROM users WHERE id = $1",
      [req.session.userId]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/update-profile", requireLogin, async (req, res) => {
  const { name, email, password } = req.body;
  const userId = req.session.userId;

  try {
    // If email is changing, ensure uniqueness
    if (email) {
      const existing = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email, userId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).send("Email already in use by another account.");
      }
    }

    // Build update dynamically
    const updates = [];
    const values = [];
    let idx = 1;

    if (name) {
      updates.push(`name = $${idx++}`);
      values.push(name);
    }
    if (email) {
      updates.push(`email = $${idx++}`);
      values.push(email);
    }
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      updates.push(`password = $${idx++}`);
      values.push(hashed);
    }

    if (updates.length === 0) {
      return res.send("Nothing to update.");
    }

    values.push(userId); // for WHERE
    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}`;
    await pool.query(query, values);

    res.send("Profile updated successfully.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating profile.");
  }
});


app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    // ignore err for now
    res.redirect("/");
  });
});

app.get("/update.html", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "update.html"));

});

app.get('/booking.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'booking.html'));
  });

app.post('/book', requireLogin, async (req, res) => {
  const { vehicleType, fromDivision, fromAddress, toDivision, toAddress } = req.body;
  try {
    const cost = costMatrix[fromDivision]?.[toDivision] ?? 1;
    const insertBooking = `
      INSERT INTO bookings
        (user_id, vehicle_type, from_district, from_address, to_district, to_address, cost)
      VALUES ($1,$2,$3,$4,$5,$6, $7)
      RETURNING *;
    `;
    const { rows } = await pool.query(insertBooking, [
      req.session.userId,
      vehicleType,
      fromDivision,
      fromAddress,
      toDivision,
      toAddress, 
      cost
    ]);
    const booking = rows[0];
    await pool.query(
      `UPDATE users
         SET orders = COALESCE(orders, '[]'::jsonb) || $1
       WHERE id = $2;`,
      [JSON.stringify(booking), req.session.userId]
    );
    res.json({ message: 'Booking received', booking });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Failed to save booking' });
  }
});


app.get('/api/orders', requireLogin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC',
      [req.session.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});