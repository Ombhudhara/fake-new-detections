/**
 * report.js — Fake News Detector Report Page Logic
 * Handles form submission, validation, and UI transitions
 */

function submitReport(event) {
  event.preventDefault();

  // Get form elements
  const linkInput = document.getElementById('report-link');
  const categorySelect = document.getElementById('report-category');
  const reasonTextarea = document.getElementById('report-reason');
  const errorMsg = document.getElementById('report-error');
  const formContainer = document.getElementById('report-form-container');
  const successCard = document.getElementById('report-success');

  // Clear previous error
  errorMsg.textContent = '';
  errorMsg.style.display = 'none';

  // Get values
  const link = linkInput.value.trim();
  const category = categorySelect.value;
  const reason = reasonTextarea.value.trim();

  // Validate: must have a valid URL
  if (!link) {
    showError('Please enter a valid URL starting with http:// or https://');
    return;
  }

  if (!link.startsWith('http://') && !link.startsWith('https://')) {
    showError('Please enter a valid URL starting with http:// or https://');
    return;
  }

  // Prepare data
  const reportData = {
    link: link,
    category: category,
    reason: reason
  };

  // Send POST request (wrap in try/catch, silently ignore errors)
  fetch('/api/report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(reportData)
  })
    .then(response => {
      console.log('Report submitted:', response.status);
    })
    .catch(err => {
      console.warn('API error (non-blocking):', err);
    })
    .finally(() => {
      // Hide form, show success
      formContainer.style.display = 'none';
      successCard.style.display = 'block';

      // Scroll to success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/**
 * Show error message with visual feedback
 * @param {string} msg - Error message to display
 */
function showError(msg) {
  const errorMsg = document.getElementById('report-error');
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';

  // Shake effect on card
  const card = document.querySelector('.report-card');
  if (card) {
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 400);
  }

  // Focus on input
  document.getElementById('report-link').focus();
}
