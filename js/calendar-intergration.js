// ========================================
// CONFIGURATION - EDIT THESE SETTINGS
// ========================================
const BOOKING_CONFIG = {
  // Business Hours (24-hour format)
  workingDays: [1, 2, 3, 4, 5], // 0=Sunday, 1=Monday, ..., 6=Saturday
  startHour: 9, // 9 AM
  endHour: 17, // 5 PM

  // Meeting Settings
  meetingDuration: 60, // minutes
  timeSlotInterval: 60, // minutes between slots

  // Availability Settings
  daysAheadToBook: 60, // How many days in advance can people book
  minHoursNotice: 24, // Minimum hours notice required

  // Your Email (for notifications)
  yourEmail: "your-email@example.com", // CHANGE THIS

  // Time Zone
  timezone: "Asia/Kolkata", // CHANGE THIS if needed
};

// ========================================
// MODAL CONTROL
// ========================================
const modal = document.getElementById("bookingModal");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const bookCallBtn = document.getElementById("bookCallBtn");

// Open modal
bookCallBtn.addEventListener("click", () => {
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
  initializeCalendar();
});

// Close modal
function closeModal() {
  modal.classList.remove("active");
  document.body.style.overflow = "auto";
  resetForm();
}

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("active")) {
    closeModal();
  }
});

// ========================================
// CALENDAR LOGIC
// ========================================
let currentDate = new Date();
let selectedDate = null;
let selectedTime = null;

const calendarMonth = document.getElementById("calendarMonth");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const timeSlotsContainer = document.getElementById("timeSlots");
const calendarSection = document.getElementById("calendarSection");
const dateTimeSummary = document.getElementById("dateTimeSummary");
const summaryText = document.getElementById("summaryText");

// Toggle calendar expand/collapse via summary bar
dateTimeSummary.addEventListener("click", () => {
  const isCollapsed = calendarSection.classList.contains("collapsed");
  if (isCollapsed) {
    expandCalendar();
  } else {
    collapseCalendar();
  }
});

function collapseCalendar() {
  calendarSection.classList.add("collapsed");
  dateTimeSummary.classList.remove("collapsed");
  dateTimeSummary.classList.remove("expanded");
}

function expandCalendar() {
  calendarSection.classList.remove("collapsed");
  dateTimeSummary.classList.remove("collapsed");
  dateTimeSummary.classList.add("expanded");
}

function initializeCalendar() {
  renderCalendar();

  prevMonthBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Update header
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  calendarMonth.textContent = `${monthNames[month]} ${year}`;

  // Clear grid
  calendarGrid.innerHTML = "";

  // Add day headers
  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayHeaders.forEach((day) => {
    const headerDiv = document.createElement("div");
    headerDiv.classList.add("calendar-day", "header");
    headerDiv.textContent = day;
    calendarGrid.appendChild(headerDiv);
  });

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Add empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    const emptyDiv = document.createElement("div");
    emptyDiv.classList.add("calendar-day", "disabled");
    calendarGrid.appendChild(emptyDiv);
  }

  // Add days of month
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + BOOKING_CONFIG.daysAheadToBook);

  const minDate = new Date();
  minDate.setHours(minDate.getHours() + BOOKING_CONFIG.minHoursNotice);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);

    const dayDiv = document.createElement("div");
    dayDiv.classList.add("calendar-day");
    dayDiv.textContent = day;

    // Check if day is today
    if (date.getTime() === today.getTime()) {
      dayDiv.classList.add("today");
    }

    // Check if day is available
    const dayOfWeek = date.getDay();
    const isWorkingDay = BOOKING_CONFIG.workingDays.includes(dayOfWeek);
    const isInRange = date >= minDate && date <= maxDate;

    if (!isWorkingDay || !isInRange) {
      dayDiv.classList.add("disabled");
    } else {
      dayDiv.addEventListener("click", () => selectDate(date, dayDiv));
    }

    calendarGrid.appendChild(dayDiv);
  }
}

function selectDate(date, element) {
  selectedDate = date;
  selectedTime = null;

  // Update UI
  document.querySelectorAll(".calendar-day.selected").forEach((el) => {
    el.classList.remove("selected");
  });
  element.classList.add("selected");

  // Render time slots
  renderTimeSlots(date);
  updateSubmitButton();
}

function renderTimeSlots(date) {
  timeSlotsContainer.innerHTML = "";

  const slots = generateTimeSlots();

  slots.forEach((slot) => {
    const slotDiv = document.createElement("div");
    slotDiv.classList.add("time-slot");
    slotDiv.textContent = slot;

    slotDiv.addEventListener("click", () => selectTime(slot, slotDiv));

    timeSlotsContainer.appendChild(slotDiv);
  });
}

function generateTimeSlots() {
  const slots = [];
  let currentSlot = BOOKING_CONFIG.startHour * 60; // Convert to minutes
  const endSlot = BOOKING_CONFIG.endHour * 60;

  while (currentSlot < endSlot) {
    const hours = Math.floor(currentSlot / 60);
    const minutes = currentSlot % 60;

    // Format time
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const displayMinutes = minutes.toString().padStart(2, "0");

    slots.push(`${displayHours}:${displayMinutes} ${period}`);

    currentSlot += BOOKING_CONFIG.timeSlotInterval;
  }

  return slots;
}

function selectTime(time, element) {
  selectedTime = time;

  // Update UI
  document.querySelectorAll(".time-slot.selected").forEach((el) => {
    el.classList.remove("selected");
  });
  element.classList.add("selected");

  // Update display
  updateDateTime();
  updateSubmitButton();

  // Collapse calendar and show summary++
  if (selectedDate && selectedTime) {
    updateSummaryText();
    setTimeout(() => {
      collapseCalendar();
    }, 300);
  }
}

function updateSummaryText() {
  if (selectedDate && selectedTime) {
    const options = { weekday: "short", month: "short", day: "numeric" };
    const dateStr = selectedDate.toLocaleDateString("en-US", options);
    summaryText.textContent = `📅 ${dateStr} at ${selectedTime}`;
  } else {
    summaryText.textContent = "No date & time selected";
  }
}

function updateDateTime() {
  const dateTimeDisplay = document.getElementById("dateTimeDisplay");

  if (selectedDate && selectedTime) {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const dateStr = selectedDate.toLocaleDateString("en-US", options);
    dateTimeDisplay.textContent = `${dateStr} at ${selectedTime}`;
  } else {
    dateTimeDisplay.textContent = "Please select a date and time";
  }
}

function updateSubmitButton() {
  const submitBtn = document.getElementById("submitBooking");
  submitBtn.disabled = !(selectedDate && selectedTime);
}

// ========================================
// FORM SUBMISSION
// ========================================
const bookingForm = document.getElementById("bookingForm");

bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Gather form data
  const formData = {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    phone: document.getElementById("phone").value,
    company: document.getElementById("company").value,
    service: document.getElementById("service").value,
    message: document.getElementById("message").value,
    date: selectedDate ? selectedDate.toISOString().split("T")[0] : null,
    time: selectedTime,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  try {
    // Send booking data to backend
    const response = await fetch(
      "https://madam-marketing.onrender.com/api/book-consultation",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Booking failed:", result);
      alert("Booking failed: " + (result.message || "Please try again later"));
      return;
    }

    // Success - open WhatsApp with booking details
    const message = `Hi Madame Marketing,
        I'd like to book a consultation.
    
        Name: ${formData.name}
        Email: ${formData.email}
        Phone: ${formData.phone}
        Service: ${formData.service}
        Date: ${selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        Time: ${selectedTime}
        Message: ${formData.message || "N/A"}`;

    window.open(
      `https://wa.me/919217938911?text=${encodeURIComponent(message)}`,
      "_blank",
    );

    // Show success message
    showSuccessMessage();
  } catch (err) {
    console.error("Error submitting booking:", err);
    alert("An unexpected error occurred. Please try again later.");
  }

  // Reset and close after short delay
  setTimeout(() => {
    closeModal();
  }, 3000);
});

function createGoogleCalendarEvent(data) {
  const dateStr = selectedDate.toISOString().split("T")[0].replace(/-/g, "");

  // Parse time
  const timeMatch = selectedTime.match(/(\d+):(\d+)\s*(AM|PM)/);
  let hours = parseInt(timeMatch[1]);
  const minutes = timeMatch[2];
  const period = timeMatch[3];

  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  const startTime = `${hours.toString().padStart(2, "0")}${minutes}00`;

  // Calculate end time
  const endDateTime = new Date(selectedDate);
  endDateTime.setHours(
    hours,
    parseInt(minutes) + BOOKING_CONFIG.meetingDuration,
    0,
  );
  const endHours = endDateTime.getHours().toString().padStart(2, "0");
  const endMinutes = endDateTime.getMinutes().toString().padStart(2, "0");
  const endTime = `${endHours}${endMinutes}00`;

  // Create Google Calendar URL
  const title = encodeURIComponent(`Consultation - ${data.name}`);
  const details = encodeURIComponent(
    `Name: ${data.name}\n` +
      `Email: ${data.email}\n` +
      `Phone: ${data.phone}\n` +
      `Company: ${data.company || "N/A"}\n` +
      `Service: ${data.service}\n` +
      `Message: ${data.message || "N/A"}`,
  );
  const location = encodeURIComponent("Online Meeting");

  const googleCalendarUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${title}` +
    `&dates=${dateStr}T${startTime}/${dateStr}T${endTime}` +
    `&details=${details}` +
    `&location=${location}` +
    `&sf=true&output=xml`;

  // Open in new tab
  window.open(googleCalendarUrl, "_blank");
}

async function sendEmailNotification(data) {
  // TODO: Set up EmailJS or similar service
  // For now, this is a placeholder
  console.log("Booking data:", data);

  // Example with EmailJS (you need to sign up and configure):
  /*
    emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', {
        to_email: BOOKING_CONFIG.yourEmail,
        from_name: data.name,
        from_email: data.email,
        phone: data.phone,
        company: data.company,
        service: data.service,
        message: data.message,
        date: selectedDate.toLocaleDateString(),
        time: selectedTime
    });
    */
}

function showSuccessMessage() {
  const dateTimeDisplay = document.getElementById("dateTimeDisplay");
  dateTimeDisplay.innerHTML =
    '<strong style="color: #4ade80;">✓ Booking confirmed! Check your email for details.</strong>';
}

function resetForm() {
  bookingForm.reset();
  selectedDate = null;
  selectedTime = null;
  currentDate = new Date();

  document
    .querySelectorAll(".calendar-day.selected, .time-slot.selected")
    .forEach((el) => {
      el.classList.remove("selected");
    });

  timeSlotsContainer.innerHTML = "";
  updateDateTime();
  updateSubmitButton();

  // Reset calendar visibility
  calendarSection.classList.remove("collapsed");
  dateTimeSummary.classList.add("collapsed");
  dateTimeSummary.classList.remove("expanded");
  summaryText.textContent = "No date & time selected";
}
