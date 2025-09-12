const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, 'attendance.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase_table();
  }
});

// Initialize database tables
function initializeDatabase_table() {
  // Create employees table
  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      emp_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating employees table:', err);
  });

  // Create attendance_records table
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_id TEXT NOT NULL,
      emp_name TEXT NOT NULL,
      attendance_type TEXT NOT NULL,
      date DATE NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (emp_id) REFERENCES employees (emp_id),
      UNIQUE(emp_id, date)
    )
  `, (err) => {
    if (err) console.error('Error creating attendance_records table:', err);
  });

  // Create index for better performance
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_attendance_emp_date 
    ON attendance_records(emp_id, date)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_attendance_date 
    ON attendance_records(date)
  `);
}

// Routes

// Get all employees
app.get('/api/employees', (req, res) => {
  db.all('SELECT * FROM employees ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Add or update employee
app.post('/api/employees', (req, res) => {
  const { emp_id, name } = req.body;
  
  if (!emp_id || !name) {
    return res.status(400).json({ error: 'Employee ID and name are required' });
  }

  db.run(`
    INSERT OR REPLACE INTO employees (emp_id, name, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `, [emp_id, name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ 
      message: 'Employee saved successfully',
      emp_id: emp_id
    });
  });
});

// Add attendance record
app.post('/api/attendance', (req, res) => {
  const { emp_id, emp_name, attendance_type, date } = req.body;
  
  if (!emp_id || !emp_name || !attendance_type || !date) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // First, ensure employee exists
  db.run(`
    INSERT OR REPLACE INTO employees (emp_id, name, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `, [emp_id, emp_name], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Then add attendance record
    db.run(`
      INSERT OR REPLACE INTO attendance_records 
      (emp_id, emp_name, attendance_type, date) 
      VALUES (?, ?, ?, ?)
    `, [emp_id, emp_name, attendance_type, date], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ 
        message: 'Attendance record added successfully',
        id: this.lastID
      });
    });
  });
});

// Get attendance records by employee ID
app.get('/api/attendance/:emp_id', (req, res) => {
  const { emp_id } = req.params;
  
  db.all(`
    SELECT * FROM attendance_records 
    WHERE emp_id = ? 
    ORDER BY date DESC
  `, [emp_id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get all attendance records
app.get('/api/attendance', (req, res) => {
  const { start_date, end_date, attendance_type } = req.query;
  
  let query = 'SELECT * FROM attendance_records WHERE 1=1';
  let params = [];

  if (start_date) {
    query += ' AND date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    query += ' AND date <= ?';
    params.push(end_date);
  }

  if (attendance_type) {
    query += ' AND attendance_type = ?';
    params.push(attendance_type);
  }

  query += ' ORDER BY date DESC, emp_id';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get attendance statistics
app.get('/api/stats', (req, res) => {
  const queries = {
    totalEmployees: 'SELECT COUNT(*) as count FROM employees',
    totalRecords: 'SELECT COUNT(*) as count FROM attendance_records',
    wfoRecords: "SELECT COUNT(*) as count FROM attendance_records WHERE attendance_type = 'WFO'",
    wfhRecords: "SELECT COUNT(*) as count FROM attendance_records WHERE attendance_type = 'WFH'",
    attendanceByType: `
      SELECT attendance_type, COUNT(*) as count 
      FROM attendance_records 
      GROUP BY attendance_type 
      ORDER BY count DESC
    `
  };

  const stats = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error(`Error in ${key} query:`, err);
        stats[key] = 0;
      } else {
        if (key === 'attendanceByType') {
          stats[key] = rows;
        } else {
          stats[key] = rows[0].count;
        }
      }
      
      completed++;
      if (completed === totalQueries) {
        res.json(stats);
      }
    });
  });
});

// Delete attendance record
app.delete('/api/attendance/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM attendance_records WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Record not found' });
    } else {
      res.json({ message: 'Record deleted successfully' });
    }
  });
});

// Get attendance for a specific date range
app.get('/api/attendance-range/:emp_id/:start_date/:end_date', (req, res) => {
  const { emp_id, start_date, end_date } = req.params;
  
  db.all(`
    SELECT * FROM attendance_records 
    WHERE emp_id = ? AND date BETWEEN ? AND ? 
    ORDER BY date DESC
  `, [emp_id, start_date, end_date], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Database location: ${dbPath}`);
});