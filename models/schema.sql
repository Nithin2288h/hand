-- ReliefSync Pro Database Schema (SQLite)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('admin', 'ngo', 'volunteer', 'citizen')),
  latitude REAL,
  longitude REAL,
  phone TEXT,
  organization TEXT,
  is_available INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_location ON users (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- Disasters table
CREATE TABLE IF NOT EXISTS disasters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Flood', 'Earthquake', 'Cyclone', 'Fire', 'Tsunami', 'Landslide', 'Drought', 'Other')),
  severity TEXT NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  description TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_km INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Closed')),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_disasters_status ON disasters (status);
CREATE INDEX IF NOT EXISTS idx_disasters_location ON disasters (latitude, longitude);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  disaster_id INTEGER REFERENCES disasters(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'disaster_alert',
  message TEXT NOT NULL,
  read_status INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications (user_id, read_status);

-- Resources table
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ngo_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'units',
  latitude REAL,
  longitude REAL,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Reserved', 'Dispatched', 'Depleted')),
  disaster_id INTEGER REFERENCES disasters(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resources_ngo ON resources (ngo_id);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources (status);

-- Help Requests table
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  citizen_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  disaster_id INTEGER REFERENCES disasters(id) ON DELETE SET NULL,
  need_type TEXT NOT NULL CHECK (need_type IN ('Food', 'Water', 'Medical', 'Shelter', 'Rescue', 'Clothing', 'Other')),
  description TEXT,
  urgency TEXT NOT NULL DEFAULT 'Medium' CHECK (urgency IN ('Low', 'Medium', 'High', 'Critical')),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled')),
  people_count INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_requests_citizen ON requests (citizen_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status);
CREATE INDEX IF NOT EXISTS idx_requests_disaster ON requests (disaster_id);

-- Volunteer Assignments table
CREATE TABLE IF NOT EXISTS volunteer_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  volunteer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  resource_id INTEGER REFERENCES resources(id) ON DELETE SET NULL,
  disaster_id INTEGER REFERENCES disasters(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Assigned' CHECK (status IN ('Assigned', 'In Progress', 'Completed', 'Cancelled')),
  notes TEXT,
  assigned_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  UNIQUE(volunteer_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_volunteer ON volunteer_assignments (volunteer_id);
CREATE INDEX IF NOT EXISTS idx_assignments_request ON volunteer_assignments (request_id);
