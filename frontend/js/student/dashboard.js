// CampusHub Student Dashboard (Leaves & Campus Issues Controller)

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.checkAuth(['student'])) return;

  const user = Auth.getUser();
  renderStudentDashboard(user);
  loadStudentMetrics();
  loadStudentLeaves();
  loadStudentIssues();

  // Setup Apply Leave Form Listener
  const leaveForm = document.getElementById('apply-leave-form');
  if (leaveForm) {
    leaveForm.addEventListener('submit', handleApplyLeave);
  }

  // Setup Report Issue Form Listener
  const issueForm = document.getElementById('report-issue-form');
  if (issueForm) {
    issueForm.addEventListener('submit', handleReportIssue);
  }
});

async function loadStudentMetrics() {
  const result = await apiFetch('/analytics/student/overview');
  const data = result?.data?.data;
  const metrics = {
    'metric-pending-leaves': data?.pendingLeavesCount,
    'metric-open-issues': data?.openIssuesCount,
    'metric-student-complaints': data?.complaintsCount,
    'metric-student-documents': data?.documentsCount,
    'metric-student-events': data?.eventRegistrationsCount
  };

  Object.entries(metrics).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = result?.ok && result.data.success && Number.isFinite(value)
        ? value
        : 'Unavailable';
    }
  });

  if (!result?.ok || !result.data.success) {
    console.error('Could not load student analytics:', result?.data?.message || 'Unknown API error');
  }
}

function renderStudentDashboard(user) {
  const studentNameEl = document.getElementById('student-name');
  const deptNameEl = document.getElementById('student-dept');

  if (studentNameEl) studentNameEl.textContent = user.name;
  if (deptNameEl) {
    deptNameEl.textContent = user.departmentId ? (user.departmentId.name || user.departmentId) : 'General Student';
  }
}

// --- LEAVE MANAGEMENT ---
async function loadStudentLeaves() {
  const tableBody = document.getElementById('student-leaves-table-body');

  if (!tableBody) return;

  const result = await apiFetch('/leaves');
  if (result.ok && result.data.success) {
    const leaves = result.data.data;
    
    if (leaves.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #94a3b8; padding: 24px;">
            No leave requests submitted yet. Click "Apply for Leave" above to submit one.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    leaves.forEach((leave) => {
      const fromFormatted = new Date(leave.fromDate).toLocaleDateString();
      const toFormatted = new Date(leave.toDate).toLocaleDateString();
      const statusBadge = getStatusBadge(leave.status);
      
      const fileLink = leave.supportingDocument
        ? `<button type="button" class="btn" style="padding: 2px 8px; font-size: 0.75rem; background: rgba(99, 102, 241, 0.2); color: #818cf8; border: none; cursor: pointer; text-decoration: underline;" onclick="viewAuthenticatedFile('/leaves/${leave._id}/download')">📄 View File</button>`
        : '<span style="color: #64748b;">None</span>';

      const cancelBtn = leave.status === 'Pending'
        ? `<button class="btn" style="padding: 4px 10px; font-size: 0.75rem; background: rgba(239, 68, 68, 0.2); color: #f87171;" onclick="cancelLeave('${leave._id}')">Cancel</button>`
        : `<span style="color: #64748b; font-size: 0.8rem;">--</span>`;

      html += `
        <tr>
          <td style="font-weight: 600; color: #f8fafc;">${leave.leaveType}</td>
          <td>${fromFormatted} to ${toFormatted}</td>
          <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${leave.reason}</td>
          <td>${fileLink}</td>
          <td>${statusBadge}</td>
          <td style="color: #cbd5e1; font-size: 0.85rem;">${leave.reviewerRemarks || '<em>No remarks</em>'}</td>
          <td>${cancelBtn}</td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }
}

async function handleApplyLeave(e) {
  e.preventDefault();
  const alertBox = document.getElementById('leave-alert');
  const submitBtn = document.getElementById('submit-leave-btn');

  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;
  const leaveType = document.getElementById('leaveType').value;
  const reason = document.getElementById('reason').value;
  const fileInput = document.getElementById('supportingDocument');

  if (new Date(fromDate) > new Date(toDate)) {
    alertBox.textContent = 'Start date cannot be after end date.';
    alertBox.className = 'alert-box alert-danger';
    alertBox.style.display = 'block';
    return;
  }

  alertBox.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  const formData = new FormData();
  formData.append('fromDate', fromDate);
  formData.append('toDate', toDate);
  formData.append('leaveType', leaveType);
  formData.append('reason', reason);

  if (fileInput.files.length > 0) {
    formData.append('supportingDocument', fileInput.files[0]);
  }

  const token = Auth.getToken();

  try {
    const response = await fetch('https://campushub-backend-dak3.onrender.com/api/leaves', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();

    if (response.ok && data.success) {
      alertBox.textContent = 'Leave request submitted successfully!';
      alertBox.className = 'alert-box alert-success';
      alertBox.style.display = 'block';
      document.getElementById('apply-leave-form').reset();
      
      setTimeout(() => {
        closeApplyLeaveModal();
        loadStudentLeaves();
      }, 1200);
    } else {
      alertBox.textContent = data.message || 'Failed to submit leave request.';
      alertBox.className = 'alert-box alert-danger';
      alertBox.style.display = 'block';
    }
  } catch (err) {
    alertBox.textContent = 'Network error while submitting leave request.';
    alertBox.className = 'alert-box alert-danger';
    alertBox.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Leave Request';
  }
}

async function cancelLeave(leaveId) {
  if (!confirm('Are you sure you want to cancel this pending leave request?')) return;

  const result = await apiFetch(`/leaves/${leaveId}/cancel`, { method: 'PATCH' });
  if (result.ok && result.data.success) {
    loadStudentLeaves();
  } else {
    alert(result.data.message || 'Failed to cancel leave request.');
  }
}

// --- CAMPUS ISSUES MANAGEMENT ---
async function loadStudentIssues() {
  const tableBody = document.getElementById('student-issues-table-body');

  if (!tableBody) return;

  const result = await apiFetch('/issues');
  if (result.ok && result.data.success) {
    const issues = result.data.data;
    
    if (issues.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #94a3b8; padding: 24px;">
            No campus issues reported yet. Click "Report Campus Issue" above to report one.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    issues.forEach((issue) => {
      const createdDate = new Date(issue.createdAt).toLocaleDateString();
      const statusBadge = getIssueStatusBadge(issue.status);
      
      const imgLink = issue.image
        ? `<a href="https://campushub-backend-dak3.onrender.com/api/${issue.image}" target="_blank" style="color: #818cf8; text-decoration: underline;">📷 Photo</a>`
        : '<span style="color: #64748b;">None</span>';

      const assignedText = issue.assignedTo ? issue.assignedTo.name : '<span style="color: #64748b;">Pending Assignment</span>';

      html += `
        <tr>
          <td style="font-weight: 600; color: #f8fafc;">${issue.title} <br><span class="badge" style="font-size: 0.7rem; background: rgba(99, 102, 241, 0.15); color: #818cf8;">${issue.category}</span></td>
          <td>${issue.location}</td>
          <td>${createdDate}</td>
          <td>${imgLink}</td>
          <td>${statusBadge}</td>
          <td style="color: #cbd5e1; font-size: 0.85rem;">${issue.resolutionRemarks || assignedText}</td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }
}

async function handleReportIssue(e) {
  e.preventDefault();
  const alertBox = document.getElementById('issue-alert');
  const submitBtn = document.getElementById('submit-issue-btn');

  const title = document.getElementById('issue-title').value.trim();
  const category = document.getElementById('issue-category').value;
  const location = document.getElementById('issue-location').value.trim();
  const description = document.getElementById('issue-description').value.trim();
  const imageInput = document.getElementById('issue-image');

  alertBox.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting Issue...';

  const formData = new FormData();
  formData.append('title', title);
  formData.append('category', category);
  formData.append('location', location);
  formData.append('description', description);

  if (imageInput.files.length > 0) {
    formData.append('image', imageInput.files[0]);
  }

  const token = Auth.getToken();

  try {
    const response = await fetch('https://campushub-backend-dak3.onrender.com//api/issues', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();

    if (response.ok && data.success) {
      alertBox.textContent = 'Campus issue reported successfully!';
      alertBox.className = 'alert-box alert-success';
      alertBox.style.display = 'block';
      document.getElementById('report-issue-form').reset();
      
      setTimeout(() => {
        closeReportIssueModal();
        loadStudentIssues();
      }, 1200);
    } else {
      alertBox.textContent = data.message || 'Failed to report issue.';
      alertBox.className = 'alert-box alert-danger';
      alertBox.style.display = 'block';
    }
  } catch (err) {
    alertBox.textContent = 'Network error while submitting campus issue.';
    alertBox.className = 'alert-box alert-danger';
    alertBox.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Campus Issue';
  }
}

// Modal Helpers
function openApplyLeaveModal() {
  const modal = document.getElementById('apply-leave-modal');
  if (modal) modal.classList.add('active');
}

function closeApplyLeaveModal() {
  const modal = document.getElementById('apply-leave-modal');
  if (modal) modal.classList.remove('active');
}

function openReportIssueModal() {
  const modal = document.getElementById('report-issue-modal');
  if (modal) modal.classList.add('active');
}

function closeReportIssueModal() {
  const modal = document.getElementById('report-issue-modal');
  if (modal) modal.classList.remove('active');
}

function getStatusBadge(status) {
  switch (status) {
    case 'Approved':
      return '<span class="badge badge-success">Approved</span>';
    case 'Rejected':
      return '<span class="badge badge-danger">Rejected</span>';
    case 'Cancelled':
      return '<span class="badge" style="background: rgba(148, 163, 184, 0.2); color: #94a3b8;">Cancelled</span>';
    case 'Pending':
    default:
      return '<span class="badge badge-warning">Pending</span>';
  }
}

function getIssueStatusBadge(status) {
  switch (status) {
    case 'Closed':
      return '<span class="badge" style="background: rgba(148, 163, 184, 0.2); color: #94a3b8;">Closed</span>';
    case 'Resolved':
      return '<span class="badge badge-success">Resolved</span>';
    case 'In Progress':
      return '<span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8;">In Progress</span>';
    case 'Assigned':
      return '<span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;">Assigned</span>';
    case 'Reported':
    default:
      return '<span class="badge badge-warning">Reported</span>';
  }
}
