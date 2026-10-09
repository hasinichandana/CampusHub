// CampusHub Faculty Dashboard (Leaves & Assigned Issues Controller)

let activeReviewLeaveId = null;
let activeProcessIssueId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.checkAuth(['faculty'])) return;

  const user = Auth.getUser();
  renderFacultyDashboard(user);
  loadFacultyLeaves();
  loadFacultyAssignedIssues();

  const statusFilter = document.getElementById('faculty-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => loadFacultyLeaves());
  }
});

function renderFacultyDashboard(user) {
  const facultyNameEl = document.getElementById('faculty-name');
  const deptNameEl = document.getElementById('faculty-dept');

  if (facultyNameEl) facultyNameEl.textContent = user.name;
  if (deptNameEl) {
    deptNameEl.textContent = user.departmentId ? (user.departmentId.name || user.departmentId) : 'Department Faculty';
  }
}

// --- LEAVE MANAGEMENT ---
async function loadFacultyLeaves() {
  const tableBody = document.getElementById('faculty-leaves-table-body');
  const pendingCountEl = document.getElementById('metric-pending-dept-leaves');
  const statusFilter = document.getElementById('faculty-status-filter');

  if (!tableBody) return;

  let endpoint = '/leaves';
  if (statusFilter && statusFilter.value) {
    endpoint += `?status=${statusFilter.value}`;
  }

  const result = await apiFetch(endpoint);
  if (result.ok && result.data.success) {
    const leaves = result.data.data;
    
    const pendingCount = leaves.filter(l => l.status === 'Pending').length;
    if (pendingCountEl) pendingCountEl.textContent = pendingCount;

    if (leaves.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #94a3b8; padding: 24px;">
            No leave requests found for your department.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    leaves.forEach((leave) => {
      const studentName = leave.studentId ? leave.studentId.name : 'Unknown Student';
      const studentPhone = leave.studentId ? leave.studentId.phone : '';
      const fromFormatted = new Date(leave.fromDate).toLocaleDateString();
      const toFormatted = new Date(leave.toDate).toLocaleDateString();
      const statusBadge = getStatusBadge(leave.status);
      
      const fileLink = leave.supportingDocument
        ? `<a href="http://localhost:5000/${leave.supportingDocument}" target="_blank" style="color: #818cf8; text-decoration: underline;">📄 View File</a>`
        : '<span style="color: #64748b;">None</span>';

      html += `
        <tr>
          <td style="font-weight: 600; color: #f8fafc;">${studentName} <br><span style="font-size: 0.75rem; color: #94a3b8;">${studentPhone}</span></td>
          <td>${leave.leaveType}</td>
          <td>${fromFormatted} to ${toFormatted}</td>
          <td>${fileLink}</td>
          <td>${statusBadge}</td>
          <td style="color: #cbd5e1; font-size: 0.85rem;">${leave.reviewerRemarks || '<em>No remarks</em>'}</td>
          <td>
            <button class="btn" style="padding: 4px 12px; font-size: 0.75rem;" onclick="openReviewModal('${leave._id}', '${studentName}', '${leave.leaveType}', '${fromFormatted}', '${toFormatted}', '${encodeURIComponent(leave.reason)}', '${leave.supportingDocument}', '${leave.status}', '${encodeURIComponent(leave.reviewerRemarks || '')}')">
              Review
            </button>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }
}

function openReviewModal(leaveId, studentName, leaveType, fromDate, toDate, encodedReason, docPath, currentStatus, encodedRemarks) {
  activeReviewLeaveId = leaveId;
  const reason = decodeURIComponent(encodedReason);
  const remarks = decodeURIComponent(encodedRemarks);

  document.getElementById('review-student-name').textContent = studentName;
  document.getElementById('review-leave-type').textContent = leaveType;
  document.getElementById('review-dates').textContent = `${fromDate} to ${toDate}`;
  document.getElementById('review-reason').textContent = reason;
  document.getElementById('reviewerRemarks').value = remarks;

  const docContainer = document.getElementById('review-doc-container');
  if (docPath) {
    docContainer.innerHTML = `<a href="http://localhost:5000/${docPath}" target="_blank" style="color: #818cf8; font-weight: 600; text-decoration: underline;">📄 Download/View Attachment</a>`;
  } else {
    docContainer.innerHTML = '<span style="color: #64748b;">No document attached</span>';
  }

  const modal = document.getElementById('review-leave-modal');
  if (modal) modal.classList.add('active');
}

function closeReviewModal() {
  activeReviewLeaveId = null;
  const modal = document.getElementById('review-leave-modal');
  if (modal) modal.classList.remove('active');
}

async function processLeave(status) {
  if (!activeReviewLeaveId) return;

  const remarks = document.getElementById('reviewerRemarks').value;
  const alertBox = document.getElementById('review-alert');

  const result = await apiFetch(`/leaves/${activeReviewLeaveId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reviewerRemarks: remarks })
  });

  if (result.ok && result.data.success) {
    closeReviewModal();
    loadFacultyLeaves();
  } else {
    alertBox.textContent = result.data.message || 'Failed to update leave request status.';
    alertBox.className = 'alert-box alert-danger';
    alertBox.style.display = 'block';
  }
}

// --- CAMPUS ISSUES MANAGEMENT ---
async function loadFacultyAssignedIssues() {
  const tableBody = document.getElementById('faculty-issues-table-body');
  const assignedCountEl = document.getElementById('metric-assigned-issues');

  if (!tableBody) return;

  const result = await apiFetch('/issues');
  if (result.ok && result.data.success) {
    const issues = result.data.data;
    
    if (assignedCountEl) assignedCountEl.textContent = issues.length;

    if (issues.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #94a3b8; padding: 24px;">
            No campus issues currently assigned to you.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    issues.forEach((issue) => {
      const studentName = issue.studentId ? issue.studentId.name : 'Unknown Reporter';
      const createdDate = new Date(issue.createdAt).toLocaleDateString();
      const statusBadge = getIssueStatusBadge(issue.status);

      const imgLink = issue.image
        ? `<a href="http://localhost:5000/${issue.image}" target="_blank" style="color: #818cf8; text-decoration: underline;">📷 Photo</a>`
        : '<span style="color: #64748b;">None</span>';

      html += `
        <tr>
          <td style="font-weight: 600; color: #f8fafc;">${issue.title} <br><span class="badge" style="font-size: 0.7rem; background: rgba(99, 102, 241, 0.15); color: #818cf8;">${issue.category}</span></td>
          <td>${studentName}</td>
          <td>${issue.location}</td>
          <td>${imgLink}</td>
          <td>${statusBadge}</td>
          <td style="color: #cbd5e1; font-size: 0.85rem;">${issue.resolutionRemarks || '<em>No remarks</em>'}</td>
          <td>
            <button class="btn" style="padding: 4px 12px; font-size: 0.75rem; background: rgba(16, 185, 129, 0.2); color: #34d399;" onclick="openProcessIssueModal('${issue._id}', '${issue.title}', '${issue.category}', '${studentName}', '${issue.location}', '${encodeURIComponent(issue.description)}', '${issue.image}', '${issue.status}', '${encodeURIComponent(issue.resolutionRemarks || '')}')">
              Process Issue
            </button>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }
}

function openProcessIssueModal(issueId, title, category, reporter, location, encodedDesc, imgPath, currentStatus, encodedRemarks) {
  activeProcessIssueId = issueId;
  const desc = decodeURIComponent(encodedDesc);
  const remarks = decodeURIComponent(encodedRemarks);

  document.getElementById('process-issue-title').textContent = title;
  document.getElementById('process-issue-reporter').textContent = `${reporter} (${location})`;
  document.getElementById('process-issue-category').textContent = category;
  document.getElementById('process-issue-desc').textContent = desc;
  document.getElementById('issueResolutionRemarks').value = remarks;

  const statusSelect = document.getElementById('issueTargetStatus');
  if (currentStatus === 'Assigned' || currentStatus === 'Reported') {
    statusSelect.value = 'In Progress';
  } else if (currentStatus === 'In Progress') {
    statusSelect.value = 'Resolved';
  } else {
    statusSelect.value = currentStatus;
  }

  const imgContainer = document.getElementById('process-issue-img-container');
  if (imgPath) {
    imgContainer.innerHTML = `<a href="http://localhost:5000/${imgPath}" target="_blank" style="color: #818cf8; font-weight: 600; text-decoration: underline;">📷 Download/View Photo</a>`;
  } else {
    imgContainer.innerHTML = '<span style="color: #64748b;">No photo attached</span>';
  }

  const modal = document.getElementById('process-issue-modal');
  if (modal) modal.classList.add('active');
}

function closeProcessIssueModal() {
  activeProcessIssueId = null;
  const modal = document.getElementById('process-issue-modal');
  if (modal) modal.classList.remove('active');
}

async function submitIssueProcess() {
  if (!activeProcessIssueId) return;

  const targetStatus = document.getElementById('issueTargetStatus').value;
  const remarks = document.getElementById('issueResolutionRemarks').value;
  const alertBox = document.getElementById('process-issue-alert');

  const result = await apiFetch(`/issues/${activeProcessIssueId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: targetStatus, resolutionRemarks: remarks })
  });

  if (result.ok && result.data.success) {
    closeProcessIssueModal();
    loadFacultyAssignedIssues();
  } else {
    alertBox.textContent = result.data.message || 'Failed to update issue status.';
    alertBox.className = 'alert-box alert-danger';
    alertBox.style.display = 'block';
  }
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
