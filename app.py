from flask import Flask, request, render_template, jsonify, session
import csv
from io import BytesIO
import os
from datetime import datetime
import re
import glob
import subprocess
import sys
import importlib
import converter  # Import the converter module
from cgpa_calculator import cgpa_bp  # Import the CGPA calculator blueprint
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import json
import sqlite3
from pathlib import Path

app = Flask(__name__)
app.secret_key = 'change-me-to-a-secure-random-value'  # change in production

# Register the CGPA calculator blueprint
app.register_blueprint(cgpa_bp)

# Create required folder structure
def create_folder_structure():
    folders = ['uploads', 'uploads/csv', 'uploads/xlsx', 'static']
    for folder in folders:
        if not os.path.exists(folder):
            os.makedirs(folder)

# Admin credential storage file
ADMIN_CREDENTIALS_FILE = 'admin_credentials.json'

# SQLite DB for persistence
DB_FILE = 'admin.db'

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    # Create admin table if not exists and insert default admin if table empty
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS admin (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE,
            password_hash TEXT,
            initialized INTEGER DEFAULT 0
        )
    ''')
    conn.commit()

    cur.execute('SELECT COUNT(*) as cnt FROM admin')
    row = cur.fetchone()
    if row['cnt'] == 0:
        # insert default credentials (initialized = 0) - admin/admin
        default_username = 'admin'
        default_password_hash = generate_password_hash('admin')
        cur.execute('INSERT INTO admin (username, password_hash, initialized) VALUES (?, ?, ?)',
                    (default_username, default_password_hash, 0))
        conn.commit()
    conn.close()

# Initialize DB on startup
init_db()

def load_admin_credentials():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT username, password_hash, initialized FROM admin LIMIT 1')
    row = cur.fetchone()
    conn.close()
    if row:
        return {
            'username': row['username'],
            'password_hash': row['password_hash'],
            'initialized': bool(row['initialized'])
        }
    # fallback - admin/admin
    return {'username': 'admin', 'password_hash': generate_password_hash('admin'), 'initialized': False}


def save_admin_credentials(username, password_hash, initialized=True):
    conn = get_db_connection()
    cur = conn.cursor()
    # If row exists update, else insert
    cur.execute('SELECT id FROM admin LIMIT 1')
    row = cur.fetchone()
    if row:
        cur.execute('UPDATE admin SET username = ?, password_hash = ?, initialized = ? WHERE id = ?',
                    (username, password_hash, 1 if initialized else 0, row['id']))
    else:
        cur.execute('INSERT INTO admin (username, password_hash, initialized) VALUES (?, ?, ?)',
                    (username, password_hash, 1 if initialized else 0))
    conn.commit()
    conn.close()

# Initialize folder structure
create_folder_structure()

# Store timetable data for each teacher
timetable_data = {}
teacher_names = set()

# Valid prefixes in hierarchical order
prefix_hierarchy = ["Ms", "Mrs", "Miss", "Ma'am", "Maam", "Mr", "Sir", "Dr", "Prof"]

# Add file modification tracking
last_modified = None
current_csv_file = None

def get_latest_xlsx_file():
    """Get the latest xlsx file from uploads/xlsx folder"""
    xlsx_files = glob.glob('uploads/xlsx/*.xlsx')
    if not xlsx_files:
        print("nothing new")
        return None
    return max(xlsx_files, key=os.path.getmtime)

def convert_xlsx_to_csv():
    """Convert latest xlsx file to csv using converter.py"""
    latest_xlsx = get_latest_xlsx_file()
    if not latest_xlsx:
        print("No xlsx files found in uploads/xlsx folder")
        return None
    
    # Get output filename
    output_filename = 'uploads/csv/' + os.path.splitext(os.path.basename(latest_xlsx))[0] + '.csv'
    
    try:
        # Reload the converter module to ensure we get fresh code
        importlib.reload(converter)
        
        # Call the converter with our input and output paths
        converter.convert_xlsx_to_csv(latest_xlsx, output_filename)
        
        return output_filename
    except Exception as e:
        print(f"Error converting xlsx to csv: {e}")
        return None

def get_current_csv_file():
    """Get the current CSV file to use"""
    global current_csv_file
    
    # Check if we need to convert xlsx to csv
    latest_xlsx = get_latest_xlsx_file()
    if latest_xlsx:
        expected_csv = 'uploads/csv/' + os.path.splitext(os.path.basename(latest_xlsx))[0] + '.csv'
        
        # Convert if CSV doesn't exist or xlsx is newer
        if not os.path.exists(expected_csv) or os.path.getmtime(latest_xlsx) > os.path.getmtime(expected_csv):
            print("Converting latest xlsx to csv...")
            converted_csv = convert_xlsx_to_csv()
            if converted_csv:
                current_csv_file = converted_csv
        else:
            current_csv_file = expected_csv
    
    # Fallback to any existing CSV in csv folder
    if not current_csv_file or not os.path.exists(current_csv_file):
        csv_files = glob.glob('uploads/csv/*.csv')
        if csv_files:
            current_csv_file = max(csv_files, key=os.path.getmtime)
    
    return current_csv_file


@app.route('/admin/login', methods=['POST'])
def admin_login():
    # Check if accessing from /admin route
    referrer = request.headers.get('Referer', '')
    if '/admin' not in referrer and request.environ.get('HTTP_REFERER', '').find('/admin') == -1:
        return jsonify({'success': False, 'message': 'Access denied. Please use /admin route.'}), 403
    
    creds = load_admin_credentials()
    body = request.get_json() or {}
    username = body.get('username', '')
    password = body.get('password', '')

    if username == creds.get('username') and check_password_hash(creds.get('password_hash'), password):
        # If credentials are not initialized (first-time/default), require password change
        if not creds.get('initialized', False):
            # Do not grant full admin; set temporary auth so user can change password
            session['admin_temp_auth'] = True
            session['admin_temp_auth_time'] = datetime.now().timestamp()
            return jsonify({'success': True, 'must_change_password': True})

        # Normal login
        session['admin_logged_in'] = True
        session['admin_login_time'] = datetime.now().timestamp()
        return jsonify({'success': True, 'must_change_password': False})

    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401


@app.route('/admin/logout', methods=['POST'])
def admin_logout():
    session.clear()
    return jsonify({'success': True})


@app.route('/admin/change_credentials', methods=['POST'])
def admin_change_credentials():
    # Check if accessing from /admin route
    referrer = request.headers.get('Referer', '')
    if '/admin' not in referrer and request.environ.get('HTTP_REFERER', '').find('/admin') == -1:
        return jsonify({'success': False, 'message': 'Access denied. Please use /admin route.'}), 403
    
    # Allow change if admin already logged in or has temporary auth (first-time)
    # Check session timeout (30 minutes)
    current_time = datetime.now().timestamp()
    if session.get('admin_logged_in'):
        login_time = session.get('admin_login_time', 0)
        if current_time - login_time > 1800:  # 30 minutes
            session.clear()
            return jsonify({'success': False, 'message': 'Session expired. Please login again.'}), 401
    elif session.get('admin_temp_auth'):
        temp_auth_time = session.get('admin_temp_auth_time', 0)
        if current_time - temp_auth_time > 300:  # 5 minutes for temp auth
            session.clear()
            return jsonify({'success': False, 'message': 'Temporary session expired. Please login again.'}), 401
    else:
        return jsonify({'success': False, 'message': 'Not authorized'}), 403

    body = request.get_json() or {}
    new_username = body.get('username', '').strip()
    new_password = body.get('password', '').strip()

    if not new_username or not new_password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400

    if len(new_password) < 6:
        return jsonify({'success': False, 'message': 'Password must be at least 6 characters long'}), 400

    save_admin_credentials(new_username, generate_password_hash(new_password), initialized=True)
    # After successful change, grant full admin and clear temp auth
    session.pop('admin_temp_auth', None)
    session.pop('admin_temp_auth_time', None)
    session['admin_logged_in'] = True
    session['admin_login_time'] = current_time
    return jsonify({'success': True})


@app.route('/admin/status', methods=['GET'])
def admin_status():
    # Check session timeout
    current_time = datetime.now().timestamp()
    if session.get('admin_logged_in'):
        login_time = session.get('admin_login_time', 0)
        if current_time - login_time > 1800:  # 30 minutes
            session.clear()
            creds = load_admin_credentials()
            return jsonify({
                'logged_in': False,
                'must_change_password': not bool(creds.get('initialized', False)),
                'username': creds.get('username'),
                'message': 'Session expired'
            })
    elif session.get('admin_temp_auth'):
        temp_auth_time = session.get('admin_temp_auth_time', 0)
        if current_time - temp_auth_time > 300:  # 5 minutes for temp auth
            session.clear()
    
    creds = load_admin_credentials()
    return jsonify({
        'logged_in': bool(session.get('admin_logged_in') or session.get('admin_temp_auth')),
        'must_change_password': not bool(creds.get('initialized', False)),
        'username': creds.get('username')
    })


@app.route('/admin/upload', methods=['POST'])
def admin_upload():
    # Check if accessing from /admin route
    referrer = request.headers.get('Referer', '')
    if '/admin' not in referrer and request.environ.get('HTTP_REFERER', '').find('/admin') == -1:
        return jsonify({'success': False, 'message': 'Access denied. Please use /admin route.'}), 403
    
    # For each upload, require admin username/password in form fields
    form_user = request.form.get('username')
    form_pass = request.form.get('password')
    if not form_user or not form_pass:
        return jsonify({'success': False, 'message': 'Upload credentials required'}), 401

    creds = load_admin_credentials()
    if form_user != creds.get('username') or not check_password_hash(creds.get('password_hash'), form_pass):
        return jsonify({'success': False, 'message': 'Invalid upload credentials'}), 401
    
    # Do not allow uploads until admin has changed default credentials
    if not creds.get('initialized', False):
        return jsonify({'success': False, 'message': 'Default credentials must be changed before uploads are allowed.'}), 403

    # Check session timeout
    current_time = datetime.now().timestamp()
    if session.get('admin_logged_in'):
        login_time = session.get('admin_login_time', 0)
        if current_time - login_time > 1800:  # 30 minutes
            session.clear()
            return jsonify({'success': False, 'message': 'Session expired. Please login again.'}), 401
    else:
        return jsonify({'success': False, 'message': 'Not authenticated'}), 401

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file uploaded'}), 400

    f = request.files['file']
    filename = secure_filename(f.filename)
    if not filename:
        return jsonify({'success': False, 'message': 'Invalid filename'}), 400

    ext = os.path.splitext(filename)[1].lower()
    try:
        if ext == '.xlsx':
            save_path = os.path.join('uploads', 'xlsx', filename)
            f.save(save_path)
            # Convert and process immediately so all users see updates
            converted = convert_xlsx_to_csv()
            if converted:
                process_file(converted)
                return jsonify({'success': True, 'message': 'Excel file uploaded, converted to CSV, and processed successfully'})
            else:
                return jsonify({'success': False, 'message': 'Failed to convert Excel file to CSV'}), 500
        elif ext in ['.xls']:
            save_path = os.path.join('uploads', 'xlsx', filename.replace('.xls', '.xlsx'))
            f.save(save_path)
            # Convert and process immediately
            converted = convert_xlsx_to_csv()
            if converted:
                process_file(converted)
                return jsonify({'success': True, 'message': 'Excel file uploaded, converted to CSV, and processed successfully'})
            else:
                return jsonify({'success': False, 'message': 'Failed to convert Excel file to CSV'}), 500
        elif ext == '.csv':
            save_path = os.path.join('uploads', 'csv', filename)
            f.save(save_path)
            process_file(save_path)
            return jsonify({'success': True, 'message': 'CSV file uploaded and processed successfully'})
        else:
            return jsonify({'success': False, 'message': 'Unsupported file type. Please upload .csv, .xls, or .xlsx files'}), 400

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error processing file: {str(e)}'}), 500

def extract_semester_info(filename):
    """Extract semester information from filename"""
    # Look for patterns like "Fall-24", "Spring-25", etc.
    match = re.search(r'(Fall|Spring|Summer)-(\d{2})', filename)
    if match:
        season = match.group(1)
        year = match.group(2)
        return f"{season}-{year}"
    return "Current Semester"

@app.route('/timetable')
def get_timetable():
    name = request.args.get('name', '').upper()
    timetable_type = request.args.get('type', 'teacher')  # 'teacher' or 'section'
    
    if name:
        if timetable_type == 'teacher':
            data = timetable_data.get(name, [])
        else:  # section timetable
            data = []
            for entries in timetable_data.values():
                for entry in entries:
                    groups = entry['groups']
                    if groups:
                        # groups is now a list, not a string
                        if isinstance(groups, list):
                            # Check if name matches any group in the list
                            if any(name.lower() in group.lower() for group in groups):
                                data.append(entry)
                        else:
                            # Fallback for string format
                            if name.lower() in groups.lower():
                                data.append(entry)
    else:
        # Return data for all teachers
        data = [entry for entries in timetable_data.values() for entry in entries]
    
    # Sort the data by day and time before returning
    sorted_data = sort_entries_by_day_and_time(data)
    
    return jsonify(sorted_data)

@app.route('/get_sections')
def get_sections():
    """Get all unique sections from the timetable data"""
    sections = set()
    for entries in timetable_data.values():
        for entry in entries:
            groups = entry['groups']
            if groups:
                # groups is now a list, not a string
                if isinstance(groups, list):
                    sections.update(groups)
                else:
                    # Fallback for string format
                    group_parts = [g.strip() for g in groups.split('/')]
                    sections.update(group_parts)
    
    return jsonify(sorted(list(sections)))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/admin')
def admin_dashboard():
    """Protected admin route"""
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    global last_modified
    
    # Get current CSV file (will convert if needed)
    csv_file = get_current_csv_file()
    
    if not csv_file or not os.path.exists(csv_file):
        teacher_names_list = []
        semester_info = "No Data"
    else:
        # Check if file has been modified
        current_modified = os.path.getmtime(csv_file)
        if last_modified != current_modified:
            process_file(csv_file)
            last_modified = current_modified
        
        teacher_names_list = sort_teachers_by_prefix_and_name(teacher_names)
        # Extract semester info from filename
        semester_info = extract_semester_info(csv_file)
    
    return jsonify({
        'teacher_count': len(teacher_names_list),
        'semester_info': semester_info,
        'has_data': bool(csv_file and os.path.exists(csv_file))
    })

def parse_multiple_teachers(teachers_str):
    """Parse multiple teachers from a string like 'Mr. John Mr. Jane Dr. Smith'"""
    teachers_str = teachers_str.strip()
    if not teachers_str:
        return []
    
    teachers = []
    current_teacher = ""
    words = teachers_str.split()
    
    for word in words:
        # Check if this word is a prefix (start of new teacher name)
        if any(word.upper().startswith(prefix.upper()) for prefix in prefix_hierarchy):
            # If we have a current teacher, add it to the list
            if current_teacher.strip():
                teachers.append(current_teacher.strip().upper())
            # Start new teacher name
            current_teacher = word
        else:
            # Continue building current teacher name
            current_teacher += " " + word
    
    # Add the last teacher
    if current_teacher.strip():
        teachers.append(current_teacher.strip().upper())
    
    return teachers

def parse_groups(group_string):
    """Parse group string and return list of individual groups"""
    if not group_string or group_string.strip() == '':
        return []
    
    # Clean the string
    group_string = group_string.strip()
    
    # Split by & and clean each part
    parts = [part.strip() for part in group_string.split('&')]
    groups = []
    current_prefix = ""
    
    for part in parts:
        # If part contains a dash, it's a full group name
        if '-' in part:
            groups.append(part)
            # Extract prefix for next iterations (e.g., "BSSE" from "BSSE-5A")
            current_prefix = part.split('-')[0]
        else:
            # It's just a number/suffix, use the current prefix
            if current_prefix and part:
                groups.append(f"{current_prefix}-{part}")
            elif part:
                # If no current prefix, this might be a standalone group
                groups.append(part)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_groups = []
    for group in groups:
        if group and group not in seen:
            seen.add(group)
            unique_groups.append(group)
    
    return unique_groups

def process_file(file_path):
    # Clear previous timetable data
    timetable_data.clear()
    teacher_names.clear()
    
    # Temporary storage for merging consecutive slots
    temp_entries = []
    
    # Read CSV file
    with open(file_path, 'r', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file)
        
        for row in csv_reader:
            day = row.get('Day', '').strip()
            time = row.get('Time', '').strip()
            room = row.get('Room', '').strip()
            subject = row.get('Subject', '').strip()
            group = row.get('Class/Group', '').strip()
            teachers_str = row.get("Teacher(s) Name", '').strip()
            
            # Skip empty rows or rows with F25 placeholder
            if not subject or subject == 'F25' or not teachers_str:
                continue
            
            # Parse multiple teachers
            teachers = parse_multiple_teachers(teachers_str)
            
            if not teachers:
                continue
            
            # Add teachers to set
            for teacher in teachers:
                teacher_names.add(teacher)
            
            # Parse and expand groups
            expanded_groups = parse_groups(group)
            
            # Extract start and end time
            if '-' in time:
                start_time, end_time = [t.strip() for t in time.split('-', 1)]
            else:
                start_time = end_time = time.strip()
            
            temp_entry = {
                "day": day,
                "start_time": start_time,
                "end_time": end_time,
                "location": room,
                "subject": subject,
                "groups": expanded_groups,
                "teachers": teachers
            }
            temp_entries.append(temp_entry)
    
    # Merge consecutive time slots
    merged_entries = merge_consecutive_slots(temp_entries)
    
    # Convert to final format and add to timetable_data
    for entry in merged_entries:
        # Create entry for each individual teacher
        for teacher in entry["teachers"]:
            final_entry = {
                "day": entry["day"],
                "start_time": entry["start_time"],
                "end_time": entry["end_time"],
                "location": entry["location"],
                "subject": entry["subject"],
                "groups": entry["groups"],
                "teachers": ", ".join(entry["teachers"])  # Keep all teachers in the display
            }
            
            # Add entry to individual teacher's timetable
            if teacher in timetable_data:
                # Check for duplicates before adding
                duplicate_found = False
                for existing_entry in timetable_data[teacher]:
                    if (existing_entry["day"] == final_entry["day"] and
                        existing_entry["start_time"] == final_entry["start_time"] and
                        existing_entry["end_time"] == final_entry["end_time"] and
                        existing_entry["location"] == final_entry["location"] and
                        existing_entry["subject"] == final_entry["subject"]):
                        duplicate_found = True
                        break
                
                if not duplicate_found:
                    timetable_data[teacher].append(final_entry)
            else:
                timetable_data[teacher] = [final_entry]

    # Sort each teacher's entries by day and time
    for teacher in timetable_data:
        timetable_data[teacher] = sort_entries_by_day_and_time(timetable_data[teacher])

def normalize_time(time_str):
    """Normalize time format for comparison"""
    time_str = time_str.strip()
    # Handle times like "01:30" vs "1:30"
    if ':' in time_str:
        parts = time_str.split(':')
        hour = parts[0].zfill(2)  # Pad with leading zero if needed
        minute = parts[1]
        return f"{hour}:{minute}"
    return time_str

def time_to_minutes(time_str):
    """Convert time string to minutes for proper sorting"""
    time_str = normalize_time(time_str)
    if ':' in time_str:
        hour, minute = time_str.split(':')
        hour = int(hour)
        minute = int(minute)
        
        # Handle 12-hour format without AM/PM indicators
        # Assume times 1-7 are PM (13-19), times 8-12 are AM (8-12)
        if hour >= 1 and hour <= 7:
            hour += 12  # Convert to 24-hour format
        
        return hour * 60 + minute
    return 0

def merge_consecutive_slots(entries):
    """Merge consecutive time slots for same subject, teacher, room, and day"""
    if not entries:
        return []
    
    # Sort entries by day, start_time, subject, location, teachers
    entries.sort(key=lambda x: (x["day"], time_to_minutes(x["start_time"]), x["subject"], x["location"], str(x["teachers"])))
    
    merged = []
    current = entries[0].copy()
    
    for i in range(1, len(entries)):
        entry = entries[i]
        
        # Normalize times for comparison
        current_end = normalize_time(current["end_time"])
        entry_start = normalize_time(entry["start_time"])
        
        # Check if this entry can be merged with current
        same_day = current["day"] == entry["day"]
        same_subject = current["subject"] == entry["subject"]
        same_location = current["location"] == entry["location"]
        same_groups = current["groups"] == entry["groups"]
        same_teachers = set(current["teachers"]) == set(entry["teachers"])
        consecutive_time = current_end == entry_start
        
        if same_day and same_subject and same_location and same_groups and same_teachers and consecutive_time:
            # print(f"MERGING: {current['day']} {current['start_time']}-{current['end_time']} + {entry['start_time']}-{entry['end_time']} = {current['start_time']}-{entry['end_time']}")
            # print(f"  Subject: {current['subject']}")
            # print(f"  Location: {current['location']}")
            # print(f"  Groups: {current['groups']}")
            # print(f"  Teachers: {current['teachers']}")
            
            # Merge by extending end time
            current["end_time"] = entry["end_time"]
        else:
            # Can't merge, add current to merged list and start new
            merged.append(current)
            current = entry.copy()
    
    # Add the last entry
    merged.append(current)
    return merged

def sort_entries_by_day_and_time(entries):
    """Sort entries by day order and then by time"""
    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    def day_time_key(entry):
        day = entry.get("day", "")
        start_time = entry.get("start_time", "")
        
        # Get day index
        day_index = day_order.index(day) if day in day_order else 999
        
        # Convert time to comparable format (remove colons, pad with zeros)
        time_parts = start_time.replace(":", "").strip()
        time_num = int(time_parts) if time_parts.isdigit() else 0
        
        return (day_index, time_num)
    
    return sorted(entries, key=day_time_key)

def generate_cards_html():
    card_html = ''
    sorted_teachers = sort_teachers_by_prefix_and_name(teacher_names)
    for teacher in sorted_teachers:
        entries = timetable_data.get(teacher, [])
        card_html += f'<div class="teacher-timetable" id="{teacher.replace(" ", "_")}">'
        card_html += '<div class="card">'
        card_html += f'<h5 class="card-title"><i class="fas fa-user-tie"></i>{teacher}</h5>'
        card_html += '<div class="table-container">'
        card_html += '<div class="table-responsive">'
        card_html += '<table class="table">'
        card_html += '<thead><tr><th><i class="fas fa-calendar-day mr-2"></i>Day</th><th><i class="fas fa-clock mr-2"></i>Start Time</th><th><i class="fas fa-clock mr-2"></i>End Time</th><th><i class="fas fa-map-marker-alt mr-2"></i>Location</th><th><i class="fas fa-book mr-2"></i>Subject</th><th><i class="fas fa-users mr-2"></i>Groups</th></tr></thead><tbody>'
        
        for entry in entries:
            card_html += f"<tr class='timetable-row' data-teacher='{teacher}'>"
            card_html += f"<td>{entry['day']}</td>"
            card_html += f"<td>{entry['start_time']}</td>"
            card_html += f"<td>{entry['end_time']}</td>"
            card_html += f"<td>{entry['location']}</td>"
            card_html += f"<td>{entry['subject']}</td>"
            card_html += f"<td>{entry['groups']}</td></tr>"
        
        card_html += '</tbody></table>'
        card_html += '</div>'
        card_html += '</div>'
        card_html += '</div>'
        card_html += '</div>'
    return card_html

        
def sort_teachers_by_prefix_and_name(teachers):
    def prefix_key(teacher):
        # Find the prefix in the teacher name
        for prefix in prefix_hierarchy:
            if teacher.startswith(prefix.upper()):
                return prefix_hierarchy.index(prefix)
        return len(prefix_hierarchy)  # Return a high value if no prefix is found

    # Sort teachers first by prefix key, then by name
    sorted_teachers = sorted(
        teachers,
        key=lambda teacher: (prefix_key(teacher), teacher)
    )
    
    return sorted_teachers

if __name__ == '__main__':
    # Process existing file on startup
    csv_file = get_current_csv_file()
    if csv_file and os.path.exists(csv_file):
        process_file(csv_file)
        last_modified = os.path.getmtime(csv_file)
    
    app.run(debug=True)
