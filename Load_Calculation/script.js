document.addEventListener('DOMContentLoaded', function() {
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const form = document.getElementById('loadCalculatorForm');
    const subjectList = document.getElementById('subjectList');
    const scheduleBody = document.getElementById('scheduleBody');
    const clearButton = document.getElementById('clearSchedule');
    const previewButton = document.getElementById('previewButton');
    const downloadButton = document.getElementById('downloadButton');
    const exportButton = document.getElementById('exportButton');
    const importInput = document.getElementById('importData');
    const summaryContainer = document.getElementById('scheduleSummary');
    
    let subjects = [];
    let lastSummaryData = null;
    let holidays = [];

    // Load holidays from CSV file
    fetch('holidays.csv')
        .then(response => response.text())
        .then(csv => {
            const lines = csv.split('\n');
			console.log(lines);
            holidays = lines
                .filter(line => line.trim()) // Skip empty lines
                .map(line => {
                    const [dateStr] = line.split(',');
                    const date = new Date(dateStr);
                    return {
                        date,
                        month: date.getMonth(),
                        day: date.getDate(),
                        name: line.split(',')[3]?.trim()
                    };
                })
                .filter(h => !isNaN(h.date) && h.name); // Filter out invalid entries
        })
        .catch(error => console.error('Error loading holidays:', error));

    // Helper function to check if a date is a holiday
    function isHoliday(date) {
        return holidays.find(h => 
            h.day === date.getDate() && 
            h.month === date.getMonth()  && 
			h.year == date.getYear()
        );
    }

    // Helper function to count hours for specific days
    function countHoursForDays(startDate, endDate, selectedDays, vacationStart, vacationEnd) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const vacStart = vacationStart ? new Date(vacationStart) : null;
        const vacEnd = vacationEnd ? new Date(vacationEnd) : null;

        let totalHours = 0;
        let vacationHours = 0;
        let holidayHours = 0;
        let holidayDates = new Set();
        
        let current = new Date(start);
        while (current <= end) {
            // Check if this day is in our selected days (0 = Sunday, 6 = Saturday)
            if (selectedDays.includes(current.getDay())) {
                // Don't count Sundays
                if (current.getDay() !== 0) {
                    // First, check if it's a vacation day
                    if (vacStart && vacEnd && current >= vacStart && current <= vacEnd) {
                        vacationHours++;
                    } else {
                        // If not a vacation day, count it as a working day
                        // Then check if it's a holiday
                        const holiday = isHoliday(current);
                        if (holiday) {
                            holidayHours++;
                            holidayDates.add(`${current.toISOString().split('T')[0]}: ${holiday.name}`);
                        }
						else{
							totalHours++;
						}
                    }
                }
            }
            current.setDate(current.getDate() + 1);
        }

        return {
            totalHours,
            vacationHours,
            holidayHours,
            holidays: Array.from(holidayDates)
        };
    }

    // Process schedule data with accurate hour calculations
    function processScheduleData() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const vacationStart = document.getElementById('vacationStart').value;
        const vacationEnd = document.getElementById('vacationEnd').value;

        if (!startDate || !endDate) {
            return null;
        }

        const subjectData = {};
        let allHolidays = new Set();

        // Process each slot in the schedule
        weekDays.forEach((day, dayIndex) => {
            for (let slot = 1; slot <= 6; slot++) {
                const subjectSelect = document.querySelector(`select[data-slot="${slot}"][data-day="${dayIndex}"]`);
                const labRadio = document.querySelector(`#lab-${slot}-${dayIndex}`);
                
                const subjectCode = subjectSelect.value;
                const type = labRadio.checked ? 'Lab' : 'Lect';
                
                if (subjectCode) {
                    const subject = subjects.find(s => s.code === subjectCode);
                    if (!subject) continue;

                    if (!subjectData[subjectCode]) {
                        subjectData[subjectCode] = {
                            'Subject Name': subject.name,
                            'Subject Code': subject.code,
                            'Total Lecture Hours per Week': 0,
                            'Total Lab Hours per Week': 0,
                            'Total Lecture Hours per Term': 0,
                            'Total Lab Hours per Term': 0,
                            'Actual Total Lecture Hours': 0,
                            'Actual Total Lab Hours': 0
                        };
                    }

                    // Count hours for this specific day
                    const hoursInfo = countHoursForDays(
                        startDate, 
                        endDate, 
                        [dayIndex === 5 ? 6 : dayIndex + 1], // Convert to Sunday-based index
                        vacationStart, 
                        vacationEnd
                    );

                    // Update weekly hours (based on schedule)
                    if (type === 'Lect') {
                        subjectData[subjectCode]['Total Lecture Hours per Week']++;
                        // Total term hours = total hours
                        subjectData[subjectCode]['Total Lecture Hours per Term'] += hoursInfo.totalHours;
                        // Actual hours = total hours - holiday hours
                        subjectData[subjectCode]['Actual Total Lecture Hours'] += 
                            hoursInfo.totalHours - hoursInfo.holidayHours;
                    } else {
                        subjectData[subjectCode]['Total Lab Hours per Week']++;
                        // Total term hours = total hours
                        subjectData[subjectCode]['Total Lab Hours per Term'] += hoursInfo.totalHours;
                        // Actual hours = total hours - holiday hours
                        subjectData[subjectCode]['Actual Total Lab Hours'] += 
                            hoursInfo.totalHours - hoursInfo.holidayHours;
                    }

                    // Collect all holidays
                    hoursInfo.holidays.forEach(h => allHolidays.add(h));
                }
            }
        });

        // Calculate total days for summary
        const totalInfo = countHoursForDays(
            startDate, 
            endDate, 
            [1,2,3,4,5,6], // All days except Sunday
            vacationStart, 
            vacationEnd
        );

        return {
            data: Object.keys(subjectData).length > 0 ? subjectData : null,
            holidays: Array.from(allHolidays),
            daysInfo: {
                totalDays: totalInfo.totalHours,
                vacationDays: totalInfo.vacationHours,
                holidayDays: totalInfo.holidayHours,
                workingDays: totalInfo.totalHours - totalInfo.holidayHours
            }
        };
    }

    // Display summary
    function displaySummary(result) {
        if (!result || !result.data) {
            summaryContainer.innerHTML = '<div class="alert alert-danger">No schedule data available.</div>';
            return;
        }

        const subjectData = result.data;
        const table = document.createElement('table');
        table.className = 'summary-table';
        
        const headers = [
            'Subject Name',
            'Subject Code',
            'Total Lecture Hours per Week',
            'Total Lab Hours per Week',
            'Total Lecture Hours per Term',
            'Total Lab Hours per Term',
            'Actual Total Lecture Hours',
            'Actual Total Lab Hours'
        ];
        
        const thead = document.createElement('thead');
        thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        Object.values(subjectData).forEach(subject => {
            tbody.innerHTML += `
                <tr>
                    <td>${subject['Subject Name']}</td>
                    <td>${subject['Subject Code']}</td>
                    <td>${subject['Total Lecture Hours per Week']}</td>
                    <td>${subject['Total Lab Hours per Week']}</td>
                    <td>${subject['Total Lecture Hours per Term']}</td>
                    <td>${subject['Total Lab Hours per Term']}</td>
                    <td>${subject['Actual Total Lecture Hours']}</td>
                    <td>${subject['Actual Total Lab Hours']}</td>
                </tr>
            `;
        });
        table.appendChild(tbody);

        // Add holiday list
        const holidayList = document.createElement('div');
        holidayList.className = 'holiday-list';
        holidayList.innerHTML = `
            <h3>Public Holidays during Term (${result.holidays.length} days)</h3>
            <ul>
                ${result.holidays.map(holiday => `<li>${holiday}</li>`).join('')}
            </ul>
            <div class="days-info">
                <p>Total Working Days: ${result.daysInfo.totalDays}</p>
                <p>Vacation Days: ${result.daysInfo.vacationDays}</p>
                <p>Net Working Days (excluding vacations): ${result.daysInfo.workingDays}</p>
                <p>Net Working Days (excluding vacations and holidays): ${result.daysInfo.workingDays - result.holidays.length}</p>
            </div>
        `;

        summaryContainer.innerHTML = '';
        summaryContainer.appendChild(table);
        summaryContainer.appendChild(holidayList);
        lastSummaryData = { subjectData, holidays: result.holidays, daysInfo: result.daysInfo };
        downloadButton.disabled = false;
    }

    // Convert data to CSV
    function convertToCSV(data) {
        const headers = [
            'Subject Name',
            'Subject Code',
            'Total Lecture Hours per Week',
            'Total Lab Hours per Week',
            'Total Lecture Hours per Term',
            'Total Lab Hours per Term',
            'Actual Total Lecture Hours',
            'Actual Total Lab Hours'
        ];

        const rows = [headers];

        Object.values(data.subjectData).forEach(subject => {
            rows.push([
                subject['Subject Name'],
                subject['Subject Code'],
                subject['Total Lecture Hours per Week'],
                subject['Total Lab Hours per Week'],
                subject['Total Lecture Hours per Term'],
                subject['Total Lab Hours per Term'],
                subject['Actual Total Lecture Hours'],
                subject['Actual Total Lab Hours']
            ]);
        });

        // Add empty row and holiday information
        rows.push([]);
        rows.push(['Public Holidays']);
        data.holidays.forEach(holiday => {
            rows.push([holiday]);
        });

        // Add days information
        rows.push([]);
        rows.push(['Summary Information']);
        rows.push(['Total Working Days', data.daysInfo.totalDays]);
        rows.push(['Vacation Days', data.daysInfo.vacationDays]);
        rows.push(['Net Working Days (excluding vacations)', data.daysInfo.workingDays]);
        rows.push(['Net Working Days (excluding vacations and holidays)', data.daysInfo.workingDays - data.holidays.length]);

        return rows.map(row => 
            row.map(cell => 
                typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell
            ).join(',')
        ).join('\n');
    }

    // Function to handle lab slot pairing
    function handleLabPairing(slot, day, subjectCode, type) {
        const slotPairs = {1: 2, 2: 1, 3: 4, 4: 3, 5: 6, 6: 5};
        
        if (type === 'Lab') {
            const pairedSlot = slotPairs[slot];
            const pairedSubjectSelect = document.querySelector(`select[data-slot="${pairedSlot}"][data-day="${day}"]`);
            const pairedTypeSelect = document.querySelector(`#lab-${pairedSlot}-${day}`);
            
            if (pairedSubjectSelect && pairedTypeSelect) {
                pairedSubjectSelect.value = subjectCode;
                pairedTypeSelect.checked = true;
            }
        }
    }

    // Create schedule table cell with subject dropdown and lab radio
    function createScheduleCell(slot, day) {
        const cell = document.createElement('td');
        const cellContainer = document.createElement('div');
        cellContainer.className = 'schedule-cell';

        // Create subject dropdown
        const select = document.createElement('select');
        select.dataset.slot = slot;
        select.dataset.day = day;
        
        // Add empty option
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '--Select Subject--';
        select.appendChild(emptyOption);
        
        // Add subject options
        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.code;
            option.textContent = `${subject.code} - ${subject.name}`;
            select.appendChild(option);
        });

        // Create lab radio button
        const labContainer = document.createElement('div');
        labContainer.className = 'lab-container';
        
        const labRadio = document.createElement('input');
        labRadio.type = 'checkbox';
        labRadio.id = `lab-${slot}-${day}`;
        labRadio.dataset.slot = slot;
        labRadio.dataset.day = day;
        labRadio.className = 'lab-radio';
        
        const labLabel = document.createElement('label');
        labLabel.htmlFor = `lab-${slot}-${day}`;
        labLabel.textContent = 'Lab';

        labContainer.appendChild(labRadio);
        labContainer.appendChild(labLabel);

        // Add change event listener for lab pairing
        labRadio.addEventListener('change', function() {
            handleLabPairing(slot, day, select.value, this.checked ? 'Lab' : 'Lect');
        });

        cellContainer.appendChild(select);
        cellContainer.appendChild(labContainer);
        cell.appendChild(cellContainer);
        return cell;
    }

    // Initialize the schedule table
    function initializeScheduleTable() {
        scheduleBody.innerHTML = '';
        for (let slot = 1; slot <= 6; slot++) {
            const row = document.createElement('tr');
            row.innerHTML = `<td>Slot ${slot}</td>`;
            
            weekDays.forEach((day, dayIndex) => {
                row.appendChild(createScheduleCell(slot, dayIndex));
            });
            
            scheduleBody.appendChild(row);
        }
    }

    // Add new subject
    document.getElementById('addSubject').addEventListener('click', function() {
        const subjectEntry = document.createElement('div');
        subjectEntry.className = 'subject-entry';
        subjectEntry.innerHTML = `
            <input type="text" class="form-control" placeholder="Subject Name" required>
            <input type="text" class="form-control" placeholder="Subject Code" required>
            <button type="button" class="remove-subject">&times;</button>
        `;
        
        subjectList.appendChild(subjectEntry);
        
        // Add remove event listener
        subjectEntry.querySelector('.remove-subject').addEventListener('click', function() {
            subjectEntry.remove();
            updateSubjects();
        });
        
        // Add change event listeners
        const inputs = subjectEntry.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('change', updateSubjects);
        });
    });

    // Update subjects array and schedule dropdowns
    function updateSubjects() {
        subjects = [];
        const entries = subjectList.querySelectorAll('.subject-entry');
        
        entries.forEach(entry => {
            const name = entry.querySelector('input:first-child').value.trim();
            const code = entry.querySelector('input:last-of-type').value.trim();
            
            if (name && code) {
                subjects.push({ name, code });
            }
        });
        
        initializeScheduleTable();
    }

    // Export data to .dat file
    function exportData() {
        const data = {
            dates: {
                startDate: document.getElementById('startDate').value,
                endDate: document.getElementById('endDate').value,
                vacationStart: document.getElementById('vacationStart').value,
                vacationEnd: document.getElementById('vacationEnd').value
            },
            subjects: subjects,
            schedule: Array.from(document.querySelectorAll('.schedule-cell')).map(cell => ({
                subject: cell.querySelector('select').value,
                type: cell.querySelector('.lab-radio').checked ? 'Lab' : 'Lect',
                slot: cell.querySelector('select').dataset.slot,
                day: cell.querySelector('select').dataset.day
            }))
        };

        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'teaching_load.dat';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Import data from .dat file
    function importData(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // Set dates
                document.getElementById('startDate').value = data.dates.startDate;
                document.getElementById('endDate').value = data.dates.endDate;
                document.getElementById('vacationStart').value = data.dates.vacationStart;
                document.getElementById('vacationEnd').value = data.dates.vacationEnd;
                
                // Clear and recreate subjects
                subjectList.innerHTML = '';
                data.subjects.forEach(subject => {
                    const entry = document.createElement('div');
                    entry.className = 'subject-entry';
                    entry.innerHTML = `
                        <input type="text" class="form-control" placeholder="Subject Name" value="${subject.name}" required>
                        <input type="text" class="form-control" placeholder="Subject Code" value="${subject.code}" required>
                        <button type="button" class="remove-subject">&times;</button>
                    `;
                    subjectList.appendChild(entry);
                });
                
                updateSubjects();
                
                // Set schedule
                data.schedule.forEach(item => {
                    const subjectSelect = document.querySelector(`select[data-slot="${item.slot}"][data-day="${item.day}"]`);
                    const labRadio = document.querySelector(`#lab-${item.slot}-${item.day}`);
                    
                    if (subjectSelect && labRadio) {
                        subjectSelect.value = item.subject;
                        labRadio.checked = item.type === 'Lab';
                    }
                });
                
            } catch (error) {
                alert('Error importing data. Please check the file format.');
            }
        };
        reader.readAsText(file);
    }

    // Date validation functions
    function validateDates() {
        const startDate = new Date(document.getElementById('startDate').value);
        const endDate = new Date(document.getElementById('endDate').value);
        const vacationStart = document.getElementById('vacationStart').value ? new Date(document.getElementById('vacationStart').value) : null;
        const vacationEnd = document.getElementById('vacationEnd').value ? new Date(document.getElementById('vacationEnd').value) : null;

        let isValid = true;
        let errorMessage = '';

        if (isNaN(startDate.getTime())) {
            isValid = false;
            errorMessage = 'Please select a valid start date.';
        } else if (isNaN(endDate.getTime())) {
            isValid = false;
            errorMessage = 'Please select a valid end date.';
        } else if (endDate <= startDate) {
            isValid = false;
            errorMessage = 'End date must be after start date.';
        }

        if (vacationStart && vacationEnd) {
            if (vacationEnd <= vacationStart) {
                isValid = false;
                errorMessage = 'Vacation end date must be after vacation start date.';
            } else if (vacationStart < startDate || vacationEnd > endDate) {
                isValid = false;
                errorMessage = 'Vacation dates must be within term dates.';
            }
        } else if ((vacationStart && !vacationEnd) || (!vacationStart && vacationEnd)) {
            isValid = false;
            errorMessage = 'Both vacation start and end dates must be provided if one is specified.';
        }

        return { isValid, errorMessage };
    }

    // Event Listeners
    clearButton.addEventListener('click', function() {
        const selects = document.querySelectorAll('.schedule-select');
        selects.forEach(select => select.value = '');
        summaryContainer.innerHTML = '';
        downloadButton.disabled = true;
        lastSummaryData = null;
    });

    previewButton.addEventListener('click', function() {
        const dateValidation = validateDates();
        if (!dateValidation.isValid) {
            summaryContainer.innerHTML = `<div class="alert alert-danger">${dateValidation.errorMessage}</div>`;
            return;
        }

        const subjectData = processScheduleData();
        if (!subjectData) {
            summaryContainer.innerHTML = '<div class="alert alert-danger">Please fill in at least one slot in the schedule.</div>';
            return;
        }

        displaySummary(subjectData);
    });

    downloadButton.addEventListener('click', function() {
        if (lastSummaryData) {
            const today = new Date().toISOString().split('T')[0];
            const csv = convertToCSV(lastSummaryData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `teaching_load_${today}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    });

    exportButton.addEventListener('click', exportData);

    importInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            importData(e.target.files[0]);
        }
    });

    // Initialize empty schedule table
    initializeScheduleTable();

    // Add CSS for the lab radio button
    const style = document.createElement('style');
    style.textContent = `
        .schedule-cell {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .lab-container {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .lab-radio {
            margin: 0;
        }
    `;
    document.head.appendChild(style);
});
