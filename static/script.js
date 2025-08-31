

// Get username/computer info
function getUserInfo() {
    // Due to browser security restrictions, we cannot access:
    // - Computer name
    // - Windows username
    // - Logged-in account information
    return 'Rasikh Ali';
}

// Update welcome message
function updateWelcomeMessage() {
    const welcomeElement = document.querySelector('.top-nav .text-muted');
    if (welcomeElement) {
        const userInfo = getUserInfo();
        welcomeElement.textContent = `Developed By, ${userInfo}`+`\u00A0\u00A0`;
    }
}

// Initialize on page load
$(document).ready(function() {
    // Update welcome message
    updateWelcomeMessage();
    
    // Initialize Select2 for better dropdowns
    $('#teacher-search').select2({
        placeholder: "Search for a teacher...",
        allowClear: true,
        width: '100%'
    });
    
    $('#section-search').select2({
        placeholder: "Search for a section...",
        allowClear: true,
        width: '100%'
    });
    
    // Initialize Select2 for dashboard class selector
    $('#dashboardClassSelect').select2({
        placeholder: "Select your class section...",
        allowClear: true,
        width: '100%'
    });
    
    // Initialize Select2 for modal class selector
    $('#modalClassSelect').select2({
        placeholder: "Select your class...",
        allowClear: true,
        width: '100%',
        dropdownParent: $('#classSelectionModal')
    });
    
    // Initialize Select2 for day selector
    $('#day-selector').select2({
        placeholder: "Choose a day...",
        allowClear: true,
        width: '100%',
        minimumResultsForSearch: -1 // Disable search for day selector
    });
    
    // Add responsive behavior for Select2 dropdowns on mobile
    $(document).on('select2:close', function(e) {
        // Remove focus from the element to dismiss keyboard on mobile
        if (window.innerWidth <= 768) {
            $(e.target).blur();
        }
    });
    
    // Load dashboard data
    loadDashboardData();
    
    // Load sections for section timetable and update dashboard
    loadSections();
    
    // Load all teacher timetables initially
    loadAllTeacherTimetables();
    
    // Load teachers for teacher search
    loadTeachers();

    // Check for class selection modal
    checkClassSelectionModal();
});

// Load dashboard data
function loadDashboardData() {
    fetch('/dashboard')
        .then(response => response.json())
        .then(data => {
            // Update dashboard elements
            const totalTeachers = document.getElementById('total-teachers');
            const currentSession = document.getElementById('current-session');
            const teacherCount = document.getElementById('teacher-count');
            
            if (totalTeachers) totalTeachers.textContent = data.teacher_count || 0;
            if (currentSession) currentSession.textContent = data.semester_info || 'No Data';
            if (teacherCount) teacherCount.textContent = `${data.teacher_count || 0} Teachers`;
        })
        .catch(error => {
            console.error('Error loading dashboard data:', error);
        });
}

// Load teachers for teacher search dropdown
function loadTeachers() {
    fetch('/timetable?type=teacher')
        .then(response => response.json())
        .then(data => {
            const teacherSelect = document.getElementById('teacher-search');
            if (!teacherSelect) return;
            
            // Get unique teachers
            const teachers = new Set();
            data.forEach(entry => {
                if (entry.teachers && !entry.teachers.includes(',')) {
                    teachers.add(entry.teachers);
                }
            });
            
            // Populate dropdown
            teacherSelect.innerHTML = '<option value="">Select a teacher...</option>';
            Array.from(teachers).sort().forEach(teacher => {
                const option = document.createElement('option');
                option.value = teacher;
                option.textContent = teacher;
                teacherSelect.appendChild(option);
            });
            
            // Refresh Select2
            $('#teacher-search').trigger('change');
        })
        .catch(error => {
            console.error('Error loading teachers:', error);
        });
}

// Check if class selection modal should be shown
function checkClassSelectionModal() {
    const selectedClass = localStorage.getItem('selectedClass');
    if (!selectedClass) {
        // Show modal after a short delay
        setTimeout(() => {
            showClassSelectionModal();
        }, 1000);
    } else {
        // Load next class for selected class
        updateNextClassForSelectedClass(selectedClass);
    }
}

// Show class selection modal
function showClassSelectionModal() {
    fetch('/get_sections')
        .then(response => response.json())
        .then(sections => {
            const select = document.getElementById('modalClassSelect');
            if (!select) return;
            
            select.innerHTML = '<option value="">Select your class...</option>';
            sections.forEach(section => {
                const option = document.createElement('option');
                option.value = section;
                option.textContent = section;
                select.appendChild(option);
            });
            
            // Trigger Select2 update for modal
            $('#modalClassSelect').trigger('change');
            
            // Also populate dashboard selector
            populateDashboardClassSelector(sections);
            
            document.getElementById('classSelectionModal').style.display = 'flex';
        })
        .catch(error => {
            console.error('Error loading sections for modal:', error);
        });
}

// Populate dashboard class selector
function populateDashboardClassSelector(sections) {
    const select = document.getElementById('dashboardClassSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select your class...</option>';
    sections.forEach(section => {
        const option = document.createElement('option');
        option.value = section;
        option.textContent = section;
        select.appendChild(option);
    });
    
    // Set selected value if exists
    const selectedClass = localStorage.getItem('selectedClass');
    if (selectedClass && sections.includes(selectedClass)) {
        select.value = selectedClass;
        document.getElementById('selectedClassInfo').style.display = 'block';
    }
    
    // Trigger Select2 update
    $('#dashboardClassSelect').trigger('change');
}

// Save selected class from modal
function saveSelectedClass() {
    const select = document.getElementById('modalClassSelect');
    if (!select) return;
    
    const selectedClass = select.value;
    if (!selectedClass) {
        alert('Please select a class');
        return;
    }
    
    localStorage.setItem('selectedClass', selectedClass);
    document.getElementById('classSelectionModal').style.display = 'none';
    
    // Update dashboard
    updateNextClassForSelectedClass(selectedClass);
    
    // Update dashboard selector
    const dashboardSelect = document.getElementById('dashboardClassSelect');
    if (dashboardSelect) {
        dashboardSelect.value = selectedClass;
        document.getElementById('selectedClassInfo').style.display = 'block';
    }
}

// Skip class selection
function skipClassSelection() {
    document.getElementById('classSelectionModal').style.display = 'none';
}

// Update dashboard when class is selected
function updateDashboardForClass() {
    const select = document.getElementById('dashboardClassSelect');
    if (!select) return;
    
    const selectedClass = select.value;
    const selectedSectionBadge = document.getElementById('selected-section-name');
    
    if (selectedClass) {
        localStorage.setItem('selectedClass', selectedClass);
        updateNextClassForSelectedClass(selectedClass);
        document.getElementById('selectedClassInfo').style.display = 'block';
        
        // Update section badge
        if (selectedSectionBadge) {
            selectedSectionBadge.textContent = selectedClass;
            selectedSectionBadge.style.display = 'inline-block';
        }
        
        // Show loading state
        showNextClassLoading();
        
        // Also update section timetable if we're on that tab
        const currentSection = document.querySelector('.content-section.active');
        if (currentSection && currentSection.id === 'section-timetable') {
            const sectionSelect = document.getElementById('section-search');
            if (sectionSelect) {
                $('#section-search').val(selectedClass).trigger('change');
                loadSectionTimetable();
            }
        }
    } else {
        localStorage.removeItem('selectedClass');
        clearNextClass();
        document.getElementById('selectedClassInfo').style.display = 'none';
        
        // Hide section badge
        if (selectedSectionBadge) {
            selectedSectionBadge.style.display = 'none';
        }
    }
}

// Show loading state for next class card
function showNextClassLoading() {
    const nextClassBody = document.getElementById('next-class-body');
    
    if (nextClassBody) {
        nextClassBody.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <p class="text-muted">Finding next class...</p>
            </div>
        `;
    }
}

// Update next class for selected class
function updateNextClassForSelectedClass(className) {
    fetch(`/timetable?name=${encodeURIComponent(className)}&type=section`)
        .then(response => response.json())
        .then(data => {
            displayNextClass(data);
        })
        .catch(error => {
            console.error('Error loading class timetable:', error);
            clearNextClass();
        });
}

// Display next upcoming class (even if it's days away)
function displayNextClass(data) {
    const nextClassBody = document.getElementById('next-class-body');
    
    if (!nextClassBody || !data || data.length === 0) {
        clearNextClass();
        return;
    }
    
    // Find the very next upcoming class
    const nextClass = findVeryNextClass(data);
    
    if (nextClass) {
        const timeUntil = getTimeUntilClass(nextClass.start_time, nextClass.day);
        const dayDisplay = getDayDisplay(nextClass.day);
        
        nextClassBody.innerHTML = `
            <div class="next-class-subject">${nextClass.subject}</div>
            <div class="next-class-teacher">
                <i class="fas fa-user-tie mr-2"></i>${nextClass.teachers}
            </div>
            <div class="next-class-teacher mb-3">
                <i class="fas fa-map-marker-alt mr-2"></i>${nextClass.location}
            </div>
            <div class="next-class-meta">
                <div class="d-flex flex-column">
                    <small class="text-muted">${dayDisplay}</small>
                    <strong style="font-size: 1.1rem; color: var(--superior-purple);">${nextClass.start_time}</strong>
                </div>
                <div class="next-class-timer next-class-timer-large" id="next-class-countdown">
                    ${timeUntil}
                </div>
            </div>`;
        
        startNextClassCountdown(nextClass.start_time, nextClass.day);
    } else {
        nextClassBody.innerHTML = `
            <div class="text-center py-3">
                <i class="fas fa-calendar-times fa-2x mb-3 text-muted"></i>
                <p class="text-muted mb-0">No upcoming classes found</p>
                <small class="text-muted">Check your schedule</small>
            </div>
        `;
    }
}

// Day Selector Functions
function loadDaySchedule() {
    const daySelect = document.getElementById('day-selector');
    const selectedDay = daySelect.value;
    const selectedDayBadge = document.getElementById('selected-day-name');
    
    if (!selectedDay) {
        clearDaySchedule();
        return;
    }
    
    // Update badge exactly like section selector
    if (selectedDayBadge) {
        selectedDayBadge.textContent = selectedDay;
        selectedDayBadge.style.display = 'inline-block';
    }
    
    // Get the currently selected section
    const dashboardSelect = document.getElementById('dashboardClassSelect');
    const selectedSection = dashboardSelect ? dashboardSelect.value : '';
    
    if (!selectedSection) {
        document.getElementById('day-schedule-body').innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-exclamation-triangle fa-3x mb-3 text-warning"></i>
                <h5 class="text-warning mb-2">No Section Selected</h5>
                <p class="text-muted mb-0">Please select your class section first from the dropdown at the top</p>
            </div>
        `;
        return;
    }
    
    // Show loading state
    document.getElementById('day-schedule-body').innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border" style="color: var(--superior-purple);" role="status">
                <span class="sr-only">Loading...</span>
            </div>
            <p class="text-muted mt-2 mb-0">Loading ${selectedDay} schedule for ${selectedSection}...</p>
        </div>
    `;
    
    // Fetch and display schedule for selected day
    fetch(`/timetable?name=${encodeURIComponent(selectedSection)}&type=section`)
        .then(response => response.json())
        .then(data => {
            displayDaySchedule(data, selectedDay);
        })
        .catch(error => {
            console.error('Error loading day schedule:', error);
            document.getElementById('day-schedule-body').innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-exclamation-triangle fa-3x mb-3 text-danger"></i>
                    <h5 class="text-danger mb-2">Error Loading Schedule</h5>
                    <p class="text-muted mb-0">Failed to load schedule data</p>
                </div>
            `;
        });
}

function displayDaySchedule(data, selectedDay) {
    // Filter for selected day's classes
    const dayClasses = data.filter(item => item.day === selectedDay);
    
    const scheduleBody = document.getElementById('day-schedule-body');
    
    if (dayClasses.length === 0) {
        scheduleBody.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-beach-parasol fa-3x mb-3 text-success"></i>
                <h5 class="text-success mb-2">No Classes on ${selectedDay}</h5>
                <p class="text-muted mb-0">Enjoy your free day!</p>
            </div>
        `;
        return;
    }
    
    // Sort by start time
    dayClasses.sort((a, b) => {
        return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
    });
    
    // Display schedule
    let scheduleHtml = '<ul class="modern-schedule-list">';
    dayClasses.forEach((classItem, index) => {
        scheduleHtml += `
            <li class="modern-schedule-item" data-class-time="${classItem.start_time}">
                <div class="left">
                    <div class="time">${classItem.start_time} - ${classItem.end_time}</div>
                    <div class="meta">
                        <div class="subject"><i class="fas fa-book mr-2"></i>${classItem.subject}</div>
                        <div class="teacher">${classItem.teachers}</div>
                    </div>
                </div>
                <div class="location">${classItem.location}</div>
            </li>`;
    });
    scheduleHtml += '</ul>';
    scheduleBody.innerHTML = scheduleHtml;
}

function setTodayAsSelected() {
    const today = new Date();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = days[today.getDay()];
    
    const daySelect = document.getElementById('day-selector');
    if (daySelect) {
        daySelect.value = todayName;
        $('#day-selector').trigger('change');
        loadDaySchedule();
    }
}

function clearDaySchedule() {
    const selectedDayBadge = document.getElementById('selected-day-name');
    if (selectedDayBadge) {
        selectedDayBadge.style.display = 'none';
    }
    
    document.getElementById('day-schedule-body').innerHTML = `
        <div class="text-center py-4">
            <i class="fas fa-calendar-check fa-3x mb-3" style="color: var(--superior-purple);"></i>
            <h5 style="color: var(--superior-purple);" class="mb-2">Select a Day and Section</h5>
            <p class="text-muted mb-0">Choose a day from the dropdown above and make sure you have selected your class section</p>
        </div>
    `;
}

// Helper function to check if a class is currently active
function isClassCurrentlyActive(classItem) {
    const now = new Date();
    const startTime = parseTimeToDate(classItem.start_time);
    const endTime = parseTimeToDate(classItem.end_time);
    
    if (!startTime || !endTime) return false;
    
    return now >= startTime && now <= endTime;
}

// Helper function to find the very next upcoming class (even if days away)
function findVeryNextClass(data) {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    let nextClass = null;
    let minTimeDiff = Infinity;
    
    data.forEach(classItem => {
        const classDayIndex = dayNames.indexOf(classItem.day);
        if (classDayIndex === -1) return;
        
        const classMinutes = timeToMinutes(classItem.start_time);
        
        // Calculate days difference
        let daysDiff = classDayIndex - currentDay;
        if (daysDiff < 0) {
            daysDiff += 7; // Next week
        } else if (daysDiff === 0 && classMinutes <= currentMinutes) {
            daysDiff = 7; // Same day but class already passed, so next week
        }
        
        // Total time difference in minutes
        const totalMinutesDiff = daysDiff * 24 * 60 + classMinutes - currentMinutes;
        
        if (totalMinutesDiff > 0 && totalMinutesDiff < minTimeDiff) {
            minTimeDiff = totalMinutesDiff;
            nextClass = classItem;
        }
    });
    
    return nextClass;
}

// Helper function to get day display text
function getDayDisplay(dayName) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[today.getDay()];
    const tomorrowName = dayNames[tomorrow.getDay()];
    
    if (dayName === todayName) {
        return "Today";
    } else if (dayName === tomorrowName) {
        return "Tomorrow";
    } else {
        return dayName;
    }
}

// Helper function to get human readable time until class (with day support)
function getTimeUntilClass(timeStr, dayName) {
    const now = new Date();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDay = now.getDay();
    const classDayIndex = dayNames.indexOf(dayName);
    
    if (classDayIndex === -1) return 'Soon';
    
    // Calculate target date
    let targetDate = new Date(now);
    let daysDiff = classDayIndex - currentDay;
    
    if (daysDiff < 0) {
        daysDiff += 7; // Next week
    } else if (daysDiff === 0) {
        // Same day - check if class time has passed
        const classTime = parseTimeToDate(timeStr);
        if (classTime && classTime <= now) {
            daysDiff = 7; // Next week
        }
    }
    
    targetDate.setDate(targetDate.getDate() + daysDiff);
    
    // Set the time
    const timeParts = timeStr.split(':');
    if (timeParts.length === 2) {
        let hours = parseInt(timeParts[0]);
        const minutes = parseInt(timeParts[1]);
        
        // Handle 12-hour format assumption
        if (hours >= 1 && hours <= 7) {
            hours += 12; // Convert to 24-hour format
        }
        
        targetDate.setHours(hours, minutes, 0, 0);
    }
    
    const diffMs = targetDate - now;
    if (diffMs <= 0) return 'Starting now';
    
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (days > 0) {
        if (remainingHours > 0) {
            return `${days}d ${remainingHours}h`;
        } else {
            return `${days} day${days > 1 ? 's' : ''}`;
        }
    } else if (remainingHours > 0) {
        return `${remainingHours}h ${mins}m`;
    } else if (mins > 0) {
        return `${mins} min`;
    } else {
        return 'Soon';
    }
}

// Helper function to parse time string to Date object
function parseTimeToDate(timeStr) {
    const now = new Date();
    const parts = timeStr.split(':');
    if (parts.length !== 2) return null;
    
    let hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    
    if (isNaN(hours) || isNaN(minutes)) return null;
    
    // Handle 12-hour format assumption (1-7 are PM)
    if (hours >= 1 && hours <= 7) {
        hours += 12;
    }
    
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    return date;
}

// Start countdown timer for next class
let nextCountdownInterval = null;
function startNextClassCountdown(timeStr, dayName) {
    if (nextCountdownInterval) clearInterval(nextCountdownInterval);
    
    function update() {
        const el = document.getElementById('next-class-countdown');
        if (!el) return;
        
        const now = new Date();
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const currentDay = now.getDay();
        const classDayIndex = dayNames.indexOf(dayName);
        
        if (classDayIndex === -1) {
            el.textContent = 'Soon';
            return;
        }
        
        // Calculate target date
        let targetDate = new Date(now);
        let daysDiff = classDayIndex - currentDay;
        
        if (daysDiff < 0) {
            daysDiff += 7; // Next week
        } else if (daysDiff === 0) {
            // Same day - check if class time has passed
            const classTime = parseTimeToDate(timeStr);
            if (classTime && classTime <= now) {
                daysDiff = 7; // Next week
            }
        }
        
        targetDate.setDate(targetDate.getDate() + daysDiff);
        
        // Set the time
        const timeParts = timeStr.split(':');
        if (timeParts.length === 2) {
            let hours = parseInt(timeParts[0]);
            const minutes = parseInt(timeParts[1]);
            
            // Handle 12-hour format assumption
            if (hours >= 1 && hours <= 7) {
                hours += 12; // Convert to 24-hour format
            }
            
            targetDate.setHours(hours, minutes, 0, 0);
        }
        
        let diffMs = targetDate - now;
        if (diffMs <= 0) {
            el.textContent = 'Starting now!';
            el.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            clearInterval(nextCountdownInterval);
            return;
        }
        
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        
        let text = '';
        if (days > 0) {
            if (remainingHours > 0) {
                text = `${days}d ${remainingHours}h`;
            } else {
                text = `${days} day${days > 1 ? 's' : ''}`;
            }
        } else if (remainingHours > 0) {
            text = `${remainingHours}h ${mins}m`;
        } else if (mins > 0) {
            text = `${mins} min`;
        } else {
            text = 'Soon';
        }
        
        el.textContent = text;
        
        // Change color based on urgency
        if (days === 0 && remainingHours === 0 && mins <= 5) {
            el.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            el.style.animation = 'pulse-red 1s infinite';
        } else if (days === 0 && remainingHours === 0 && mins <= 15) {
            el.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
            el.style.animation = 'none';
        } else if (days === 0 && remainingHours <= 1) {
            el.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
            el.style.animation = 'none';
        } else {
            el.style.background = 'linear-gradient(135deg, var(--superior-purple) 0%, var(--superior-light-purple) 100%)';
            el.style.animation = 'none';
        }
    }
    
    update();
    nextCountdownInterval = setInterval(update, 30000); // Update every 30 seconds for longer intervals
}

// Clear next class display
function clearNextClass() {
    const nextClassBody = document.getElementById('next-class-body');
    
    if (nextClassBody) {
        nextClassBody.innerHTML = `
            <div class="text-center py-3">
                <i class="fas fa-clock fa-2x mb-3 text-muted"></i>
                <p class="text-muted mb-0">No upcoming class</p>
                <small class="text-muted">Select your section to see next class</small>
            </div>
        `;
    }
    
    // Clear countdown
    if (nextCountdownInterval) {
        clearInterval(nextCountdownInterval);
        nextCountdownInterval = null;
    }
}

// Sidebar functionality
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// Close sidebar when clicking overlay
document.getElementById('overlay').addEventListener('click', function() {
    toggleSidebar();
});

// Close sidebar when clicking on main content on mobile devices
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const burgerBtn = document.querySelector('.burger-btn');
    
    // Check if click is outside sidebar and not on burger button
    if (sidebar && sidebar.classList.contains('active') && 
        !sidebar.contains(event.target) && 
        !burgerBtn.contains(event.target)) {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }
});

// Section navigation
function showSection(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Update sidebar active state
    const menuItems = document.querySelectorAll('.sidebar-menu a');
    menuItems.forEach(item => item.classList.remove('active'));

    // Activate the sidebar link with matching data-section or id
    let activated = false;
    menuItems.forEach(item => {
        const ds = item.getAttribute('data-section');
        if (ds === sectionId) {
            item.classList.add('active');
            activated = true;
        }
    });

    // Fallback: if the click event provided a target, try to activate it
    try {
        if (!activated && window.event && window.event.target) {
            const tgt = window.event.target.closest('a');
            if (tgt) tgt.classList.add('active');
        }
    } catch (e) { /* ignore */ }

    // Close sidebar for small screens for better UX
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }

    // Handle admin panel initialization
    if (sectionId === 'admin-panel') {
        initializeAdminPanel();
    }
}

// Admin Panel Functions
function initializeAdminPanel() {
    checkAdminStatus();
}

function checkAdminStatus() {
    fetch('/admin/status')
        .then(response => response.json())
        .then(data => {
            if (data.logged_in) {
                if (data.must_change_password) {
                    showChangeCredentialsSection();
                } else {
                    showAdminDashboard();
                    updateCurrentAdminUsername(data.username);
                }
            } else {
                showLoginSection();
            }
        })
        .catch(error => {
            console.error('Error checking admin status:', error);
            showLoginSection();
        });
}

function showLoginSection() {
    document.getElementById('admin-login-section').style.display = 'block';
    document.getElementById('admin-change-credentials-section').style.display = 'none';
    document.getElementById('admin-dashboard-section').style.display = 'none';
    clearAdminMessages();
}

function showChangeCredentialsSection() {
    document.getElementById('admin-login-section').style.display = 'none';
    document.getElementById('admin-change-credentials-section').style.display = 'block';
    document.getElementById('admin-dashboard-section').style.display = 'none';
    clearAdminMessages();
}

function showAdminDashboard() {
    document.getElementById('admin-login-section').style.display = 'none';
    document.getElementById('admin-change-credentials-section').style.display = 'none';
    document.getElementById('admin-dashboard-section').style.display = 'block';
    clearAdminMessages();
}

function adminLogin() {
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;

    if (!username || !password) {
        showAdminMessage('admin-login-message', 'Please enter both username and password', 'error');
        return;
    }

    const loginBtn = event.target;
    setButtonLoading(loginBtn, true);

    fetch('/admin/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        setButtonLoading(loginBtn, false);
        
        if (data.success) {
            if (data.must_change_password) {
                showChangeCredentialsSection();
                showAdminMessage('admin-change-message', 'You must change the default credentials before proceeding.', 'warning');
            } else {
                showAdminDashboard();
                updateCurrentAdminUsername(username);
                showAdminMessage('upload-message', 'Successfully logged in!', 'success');
            }
            // Clear login form
            document.getElementById('admin-username').value = '';
            document.getElementById('admin-password').value = '';
        } else {
            showAdminMessage('admin-login-message', data.message || 'Login failed', 'error');
        }
    })
    .catch(error => {
        setButtonLoading(loginBtn, false);
        console.error('Login error:', error);
        showAdminMessage('admin-login-message', 'An error occurred during login', 'error');
    });
}

function changeAdminCredentials() {
    const newUsername = document.getElementById('new-admin-username').value.trim();
    const newPassword = document.getElementById('new-admin-password').value;
    const confirmPassword = document.getElementById('confirm-admin-password').value;

    if (!newUsername || !newPassword || !confirmPassword) {
        showAdminMessage('admin-change-message', 'Please fill in all fields', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showAdminMessage('admin-change-message', 'Passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showAdminMessage('admin-change-message', 'Password must be at least 6 characters long', 'error');
        return;
    }

    const changeBtn = event.target;
    setButtonLoading(changeBtn, true);

    fetch('/admin/change_credentials', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            username: newUsername, 
            password: newPassword 
        })
    })
    .then(response => response.json())
    .then(data => {
        setButtonLoading(changeBtn, false);
        
        if (data.success) {
            showAdminDashboard();
            updateCurrentAdminUsername(newUsername);
            showAdminMessage('upload-message', 'Credentials changed successfully!', 'success');
            // Clear form
            document.getElementById('new-admin-username').value = '';
            document.getElementById('new-admin-password').value = '';
            document.getElementById('confirm-admin-password').value = '';
        } else {
            showAdminMessage('admin-change-message', data.message || 'Failed to change credentials', 'error');
        }
    })
    .catch(error => {
        setButtonLoading(changeBtn, false);
        console.error('Change credentials error:', error);
        showAdminMessage('admin-change-message', 'An error occurred while changing credentials', 'error');
    });
}

function uploadTimetableFile() {
    const fileInput = document.getElementById('upload-file');
    const username = document.getElementById('upload-username').value.trim();
    const password = document.getElementById('upload-password').value;

    if (!fileInput.files[0]) {
        showAdminMessage('upload-message', 'Please select a file to upload', 'error');
        return;
    }

    if (!username || !password) {
        showAdminMessage('upload-message', 'Please enter your admin credentials', 'error');
        return;
    }

    const file = fileInput.files[0];
    const allowedTypes = ['.csv', '.xls', '.xlsx'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
        showAdminMessage('upload-message', 'Please select a valid file type (.csv, .xls, .xlsx)', 'error');
        return;
    }

    const uploadBtn = event.target;
    setButtonLoading(uploadBtn, true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('username', username);
    formData.append('password', password);

    fetch('/admin/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        setButtonLoading(uploadBtn, false);
        
        if (data.success) {
            showAdminMessage('upload-message', data.message || 'File uploaded and processed successfully!', 'success');
            // Clear form
            fileInput.value = '';
            document.getElementById('upload-username').value = '';
            document.getElementById('upload-password').value = '';
            // Refresh dashboard data to show new timetable
            setTimeout(() => {
                loadDashboardData();
                loadTeachers();
                loadSections();
            }, 1000);
        } else {
            showAdminMessage('upload-message', data.message || 'Upload failed', 'error');
        }
    })
    .catch(error => {
        setButtonLoading(uploadBtn, false);
        console.error('Upload error:', error);
        showAdminMessage('upload-message', 'An error occurred during upload', 'error');
    });
}

function adminLogout() {
    fetch('/admin/logout', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showLoginSection();
            showAdminMessage('admin-login-message', 'Successfully logged out', 'success');
        }
    })
    .catch(error => {
        console.error('Logout error:', error);
    });
}

function updateCurrentAdminUsername(username) {
    const usernameElement = document.getElementById('current-admin-username');
    if (usernameElement) {
        usernameElement.textContent = username;
    }
}

function showAdminMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.innerHTML = `<div class="admin-message ${type}">
        <i class="fas fa-${getMessageIcon(type)} mr-2"></i>${message}
    </div>`;
}

function getMessageIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-triangle';
        case 'warning': return 'exclamation-circle';
        case 'info': return 'info-circle';
        default: return 'info-circle';
    }
}

function clearAdminMessages() {
    const messageElements = [
        'admin-login-message',
        'admin-change-message', 
        'upload-message'
    ];
    
    messageElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = '';
        }
    });
}

function setButtonLoading(button, loading) {
    if (loading) {
        button.classList.add('loading');
        button.disabled = true;
        button.setAttribute('data-original-text', button.innerHTML);
        button.innerHTML = '<span class="loading"></span> Loading...';
    } else {
        button.classList.remove('loading');
        button.disabled = false;
        const originalText = button.getAttribute('data-original-text');
        if (originalText) {
            button.innerHTML = originalText;
        }
    }
}

// Add keyboard event listeners for admin forms
document.addEventListener('DOMContentLoaded', function() {
    // Login form enter key support
    const adminUsername = document.getElementById('admin-username');
    const adminPassword = document.getElementById('admin-password');
    
    if (adminUsername && adminPassword) {
        [adminUsername, adminPassword].forEach(input => {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    adminLogin();
                }
            });
        });
    }

    // Change credentials form enter key support
    const newUsername = document.getElementById('new-admin-username');
    const newPassword = document.getElementById('new-admin-password');
    const confirmPassword = document.getElementById('confirm-admin-password');
    
    if (newUsername && newPassword && confirmPassword) {
        [newUsername, newPassword, confirmPassword].forEach(input => {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    changeAdminCredentials();
                }
            });
        });
    }
});

// Theme toggle functionality
function toggleTheme() {
    const body = document.body;
    const html = document.documentElement;
    const themeIcon = document.getElementById('theme-icon');
    
    if (body.getAttribute('data-bs-theme') === 'dark') {
        body.setAttribute('data-bs-theme', 'light');
        html.setAttribute('data-bs-theme', 'light');
        themeIcon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    } else {
        body.setAttribute('data-bs-theme', 'dark');
        html.setAttribute('data-bs-theme', 'dark');
        themeIcon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    }
}

// Load saved theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const body = document.body;
    const html = document.documentElement;
    const themeIcon = document.getElementById('theme-icon');
    
    body.setAttribute('data-bs-theme', savedTheme);
    html.setAttribute('data-bs-theme', savedTheme);
    themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Load theme on page load
document.addEventListener('DOMContentLoaded', loadTheme);

// Load sections from server and update dashboard count
function loadSections() {
    fetch('/get_sections')
        .then(response => response.json())
        .then(sections => {
            const sectionSelect = document.getElementById('section-search');
            if (sectionSelect) {
                sectionSelect.innerHTML = '<option value="">Select a section...</option>';
                
                sections.forEach(section => {
                    const option = document.createElement('option');
                    option.value = section;
                    option.textContent = section;
                    sectionSelect.appendChild(option);
                });
                
                // Refresh Select2
                $('#section-search').trigger('change');
            }
            
            // Update dashboard section count
            const sectionCountElement = document.getElementById('section-count');
            if (sectionCountElement) {
                sectionCountElement.textContent = `${sections.length} Sections`;
            }
            
            // Populate dashboard class selector if modal sections aren't loaded yet
            const dashboardSelect = document.getElementById('dashboardClassSelect');
            if (dashboardSelect && dashboardSelect.children.length <= 1) {
                populateDashboardClassSelector(sections);
            }
        })
        .catch(error => {
            console.error('Error loading sections:', error);
            const sectionCountElement = document.getElementById('section-count');
            if (sectionCountElement) {
                sectionCountElement.textContent = 'Error loading';
            }
        });
}

// -------------------- Export / Print for selected section --------------------
function exportSectionTimetable() {
    const sectionName = document.getElementById('section-search').value;
    if (!sectionName) return alert('Select a section first');

    // Fetch the timetable and open new window for printing
    fetch(`/timetable?name=${encodeURIComponent(sectionName)}&type=section`)
        .then(r => r.json())
        .then(data => {
            let html = `<html><head><title>${sectionName} Timetable</title>`;
            html += '<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">';
            html += '</head><body><div class="container"><h3>' + sectionName + ' Timetable</h3><table class="table table-bordered"><thead><tr><th>Day</th><th>Start</th><th>End</th><th>Location</th><th>Subject</th><th>Teacher</th></tr></thead><tbody>';
            data.forEach(entry => {
                html += `<tr><td>${entry.day}</td><td>${entry.start_time}</td><td>${entry.end_time}</td><td>${entry.location}</td><td>${entry.subject}</td><td>${entry.teachers}</td></tr>`;
            });
            html += '</tbody></table></div><script>window.onload=function(){window.print()}</script></body></html>';
            const w = window.open('', '_blank');
            w.document.write(html);
            w.document.close();
        });
}

// Add export button to section timetable area
const sectionContainerObserver = new MutationObserver(() => {
    const container = document.getElementById('section-timetable-container');
    if (!container) return;
    if (!document.getElementById('export-section-btn')) {
        const btn = document.createElement('button');
        btn.id = 'export-section-btn';
        btn.className = 'btn btn-outline-primary mb-3';
        btn.textContent = 'Export / Print Section Timetable';
        btn.onclick = exportSectionTimetable;
        container.parentNode.insertBefore(btn, container);
    }
});
sectionContainerObserver.observe(document.body, { childList: true, subtree: true });

// Sort entries by day and time
function sortEntriesByDayAndTime(entries) {
    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    
    return entries.sort((a, b) => {
        // First sort by day
        const dayA = dayOrder.indexOf(a.day);
        const dayB = dayOrder.indexOf(b.day);
        
        if (dayA !== dayB) {
            return dayA - dayB;
        }
        
        // Then sort by start time
        const timeA = timeToMinutes(a.start_time);
        const timeB = timeToMinutes(b.start_time);
        
        return timeA - timeB;
    });
}

// Convert time string to minutes for sorting
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    
    let hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    
    // Handle 12-hour format without AM/PM indicators
    // Assume times 1-7 are PM (13-19), times 8-12 are AM (8-12)
    if (hours >= 1 && hours <= 7) {
        hours += 12; // Convert to 24-hour format (1 PM = 13, 2 PM = 14, etc.)
    }
    
    return hours * 60 + minutes;
}

// Load all teacher timetables
function loadAllTeacherTimetables() {
    const container = document.getElementById('teacher-timetable-container');
    container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Loading all timetables...</p></div>';
    
    fetch('/timetable?type=teacher')
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                container.innerHTML = '<div class="text-center text-muted"><i class="fas fa-info-circle fa-2x mb-3"></i><p>No timetables found.</p></div>';
                return;
            }
            
            // Group data by teacher, but filter out combined teacher entries
            const teacherGroups = {};
            data.forEach(entry => {
                const teacherName = entry.teachers;
                // Skip entries where teacher name contains commas (combined teachers)
                if (!teacherName.includes(',')) {
                    if (!teacherGroups[teacherName]) {
                        teacherGroups[teacherName] = [];
                    }
                    teacherGroups[teacherName].push(entry);
                }
            });
            
            let html = '';
            Object.keys(teacherGroups).sort().forEach(teacher => {
                // Sort each teacher's data and remove duplicates
                const sortedData = sortEntriesByDayAndTime(teacherGroups[teacher]);
                const uniqueData = removeDuplicateEntries(sortedData);
                html += generateTeacherTimetableHTML(teacher, uniqueData);
            });
            
            container.innerHTML = html;
        })
        .catch(error => {
            // console.error('Error loading all timetables:', error);
            container.innerHTML = '<div class="text-center text-danger"><i class="fas fa-exclamation-triangle fa-2x mb-3"></i><p>Error loading timetables. Please try again.</p></div>';
        });
}

// Generate teacher timetable HTML
function generateTeacherTimetableHTML(teacherName, data) {
    let html = `
        <div class="teacher-timetable" id="${teacherName.replace(/[^a-zA-Z0-9]/g, '_')}">
            <div class="card">
                <h5 class="card-title"><i class="fas fa-user-tie"></i>${teacherName}</h5>
                <div class="table-container">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th><i class="fas fa-calendar-day mr-2"></i>Day</th>
                                    <th><i class="fas fa-clock mr-2"></i>Start Time</th>
                                    <th><i class="fas fa-clock mr-2"></i>End Time</th>
                                    <th><i class="fas fa-map-marker-alt mr-2"></i>Location</th>
                                    <th><i class="fas fa-book mr-2"></i>Subject</th>
                                    <th><i class="fas fa-users mr-2"></i>Groups</th>
                                </tr>
                            </thead>
                            <tbody>
    `;
    
    data.forEach(entry => {
        // Format groups properly
        let groupsDisplay = '';
        if (Array.isArray(entry.groups)) {
            groupsDisplay = entry.groups.join(', ');
        } else {
            groupsDisplay = entry.groups || '';
        }
        
        html += `
            <tr>
                <td>${entry.day}</td>
                <td>${entry.start_time}</td>
                <td>${entry.end_time}</td>
                <td>${entry.location}</td>
                <td>${entry.subject}</td>
                <td>${groupsDisplay}</td>
            </tr>
        `;
    });
    
    html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

// Load teacher timetable
function loadTeacherTimetable() {
    const teacherName = document.getElementById('teacher-search').value;
    const container = document.getElementById('teacher-timetable-container');
    
    if (!teacherName) {
        loadAllTeacherTimetables();
        return;
    }
    
    // Show loading
    container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Loading timetable...</p></div>';
    
    fetch(`/timetable?name=${encodeURIComponent(teacherName)}&type=teacher`)
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                container.innerHTML = '<div class="text-center text-muted"><i class="fas fa-info-circle fa-2x mb-3"></i><p>No timetable found for this teacher.</p></div>';
                return;
            }
            
            // Sort the data and remove duplicates
            const sortedData = sortEntriesByDayAndTime(data);
            const uniqueData = removeDuplicateEntries(sortedData);
            container.innerHTML = generateTeacherTimetableHTML(teacherName, uniqueData);
        })
        .catch(error => {
            // console.error('Error loading teacher timetable:', error);
            container.innerHTML = '<div class="text-center text-danger"><i class="fas fa-exclamation-triangle fa-2x mb-3"></i><p>Error loading timetable. Please try again.</p></div>';
        });
}

// Load section timetable
function loadSectionTimetable() {
    const sectionName = document.getElementById('section-search').value;
    const container = document.getElementById('section-timetable-container');
    
    if (!sectionName) {
        container.innerHTML = '<div class="text-center text-muted"><i class="fas fa-info-circle fa-2x mb-3"></i><p>Please select a section to view its timetable.</p></div>';
        return;
    }
    
    // Also update dashboard selection if different
    const dashboardSelect = document.getElementById('dashboardClassSelect');
    if (dashboardSelect && dashboardSelect.value !== sectionName) {
        dashboardSelect.value = sectionName;
        $('#dashboardClassSelect').trigger('change');
        localStorage.setItem('selectedClass', sectionName);
        updateDashboardForSelectedClass(sectionName);
        document.getElementById('selectedClassInfo').style.display = 'block';
        
        // Update section badge
        const selectedSectionBadge = document.getElementById('selected-section-name');
        if (selectedSectionBadge) {
            selectedSectionBadge.textContent = sectionName;
            selectedSectionBadge.style.display = 'inline-block';
        }
    }
    
    // Show loading
    container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Loading timetable...</p></div>';
    
    fetch(`/timetable?name=${encodeURIComponent(sectionName)}&type=section`)
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                container.innerHTML = '<div class="text-center text-muted"><i class="fas fa-info-circle fa-2x mb-3"></i><p>No timetable found for this section.</p></div>';
                return;
            }
            
            // Sort the data and remove duplicates with merging
            const sortedData = sortEntriesByDayAndTime(data);
            const uniqueData = removeDuplicateEntries(sortedData);
            
            // Generate HTML for the timetable
            let html = `
                <div class="section-timetable">
                    <div class="card">
                        <h5 class="card-title"><i class="fas fa-users"></i>${sectionName} - Complete Timetable</h5>
                        <div class="table-container">
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th><i class="fas fa-calendar-day mr-2"></i>Day</th>
                                            <th><i class="fas fa-clock mr-2"></i>Start Time</th>
                                            <th><i class="fas fa-clock mr-2"></i>End Time</th>
                                            <th><i class="fas fa-map-marker-alt mr-2"></i>Location</th>
                                            <th><i class="fas fa-book mr-2"></i>Subject</th>
                                            <th><i class="fas fa-chalkboard-teacher mr-2"></i>Teacher</th>
                                        </tr>
                                    </thead>
                                    <tbody>
            `;
            
            uniqueData.forEach(entry => {
                html += `
                    <tr>
                        <td>${entry.day}</td>
                        <td>${entry.start_time}</td>
                        <td>${entry.end_time}</td>
                        <td>${entry.location}</td>
                        <td>${entry.subject}</td>
                        <td>${entry.teachers}</td>
                    </tr>
                `;
            });
            
            html += `
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
        })
        .catch(error => {
            // console.error('Error loading section timetable:', error);
            container.innerHTML = '<div class="text-center text-danger"><i class="fas fa-exclamation-triangle fa-2x mb-3"></i><p>Error loading timetable. Please try again.</p></div>';
        });
}

// Clear selections
function clearTeacherSelection() {
    $('#teacher-search').val(null).trigger('change');
    loadAllTeacherTimetables();
}

function clearSectionSelection() {
    $('#section-search').val(null).trigger('change');
    document.getElementById('section-timetable-container').innerHTML = '<div class="text-center text-muted"><i class="fas fa-info-circle fa-2x mb-3"></i><p>Please select a section to view its timetable.</p></div>';
}

// Loading state for buttons
function addLoadingState(button) {
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loading"></span> Loading...';
    button.disabled = true;
    
    setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
    }, 2000);
}

// Remove duplicate entries and merge consecutive slots
function removeDuplicateEntries(entries) {
    // First remove exact duplicates
    const uniqueEntries = [];
    const seen = new Set();
    
    entries.forEach(entry => {
        const key = `${entry.day}-${entry.start_time}-${entry.end_time}-${entry.location}-${entry.subject}-${entry.teachers}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueEntries.push(entry);
        }
    });
    
    // Then merge consecutive time slots
    return mergeConsecutiveSlots(uniqueEntries);
}

// Merge consecutive time slots in JavaScript
function mergeConsecutiveSlots(entries) {
    if (!entries || entries.length === 0) return [];
    
    // Sort entries first
    entries.sort((a, b) => {
        const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const dayA = dayOrder.indexOf(a.day);
        const dayB = dayOrder.indexOf(b.day);
        
        if (dayA !== dayB) return dayA - dayB;
        
        const timeA = timeToMinutes(a.start_time);
        const timeB = timeToMinutes(b.start_time);
        
        if (timeA !== timeB) return timeA - timeB;
        
        // Sort by subject, location, teachers for consistent grouping
        return (a.subject + a.location + a.teachers).localeCompare(b.subject + b.location + b.teachers);
    });
    
    const merged = [];
    let current = { ...entries[0] };
    
    for (let i = 1; i < entries.length; i++) {
        const entry = entries[i];
        
        // Check if entries can be merged
        const sameDay = current.day === entry.day;
        const sameSubject = current.subject === entry.subject;
        const sameLocation = current.location === entry.location;
        const sameTeachers = current.teachers === entry.teachers;
        const sameGroups = JSON.stringify(current.groups) === JSON.stringify(entry.groups);
        const consecutiveTime = current.end_time === entry.start_time;
        
        if (sameDay && sameSubject && sameLocation && sameTeachers && sameGroups && consecutiveTime) {
            // Merge by extending end time
            current.end_time = entry.end_time;
            // console.log(`Merged: ${current.day} ${current.start_time}-${current.end_time} ${current.subject}`);
        } else {
            // Can't merge, add current to merged list and start new
            merged.push(current);
            current = { ...entry };
        }
    }
    
    // Add the last entry
    merged.push(current);
    return merged;
}
