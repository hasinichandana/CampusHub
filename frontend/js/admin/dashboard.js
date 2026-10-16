// CampusHub Admin Dashboard (Leaves & Campus Issues Controller)

let activeAdminReviewLeaveId = null;
let activeAdminAssignIssueId = null;
let activeAdminCloseIssueId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.checkAuth(['admin'])) return;

  const user = Auth.getUser();
  renderAdminDashboard(user);
  fetchSystemMetrics();
  loadDepartmentsFilter();
  loadFacultyMembersList();
  loadAdminLeaves();
  loadAdminIssues();

  const statusFilter = document.getElementById('admin-status-filter');
  const deptFilter = document.getElementById('admin-dept-filter');
  const issueStatusFilter = document.getElementById('admin-issue-status-filter');
  const issueCategoryFilter = document.getElementById('admin-issue-category-filter');

  if (statusFilter) statusFilter.addEventListener('change', () => loadAdminLeaves());
  if (deptFilter) deptFilter.addEventListener('change', () => loadAdminLeaves());
  if (issueStatusFilter) issueStatusFilter.addEventListener('change', () => loadAdminIssues());
  if (issueCategoryFilter) issueCategoryFilter.addEventListener('change', () => loadAdminIssues());
});

function renderAdminDashboard(user) {
  const adminNameEl = document.getElementById('admin-name');
  if (adminNameEl) adminNameEl.textContent = user.name;
}

async function fetchSystemMetrics() {
  const result = await apiFetch('/analytics/admin/overview');
  const metrics = {
    'metric-dept-count': result?.data?.data?.departments?.total,
    'metric-user-count': result?.data?.data?.users?.total,
    'metric-pending-leaves': result?.data?.data?.leaves?.pending,
    'metric-open-issues': result?.data?.data?.issues?.open,
    'metric-open-complaints': result?.data?.data?.complaints?.open,
    'metric-pending-documents': result?.data?.data?.documents?.pending
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
    console.error('Could not load admin analytics:', result?.data?.message || 'Unknown API error');
  }
}

async function loadDepartmentsFilter() {
  const deptSelect = document.getElementById('admin-dept-filter');
  if (!deptSelect) return;

  const result = await apiFetch('/test/db');
  if (result.ok && result.data.success) {
    const depts = result.data.data.departments;
    let html = '<option value="">All Departments</option>';
    depts.forEach((d) => {
      html += `<option value="${d._id}">${d.code} - ${d.name}</option>`;
    });
    deptSelect.innerHTML = html;
  }
}

async function loadFacultyMembersList() {
  const result = await apiFetch('/test/db');
  if (result.ok && result.data.success) {
    const users = result.data.data.users;
    const facultyUsers = users.filter(u => u.role === 'faculty' || u.role === 'admin');
    
    const assignSelect = document.getElementById('assignFacultySelect');
    if (assignSelect) {
      let html = '<option value="">-- Select Faculty Member --</option>';
      facultyUsers.forEach(f => {
        const deptCode = f.departmentId ? f.departmentId.code : 'ADMIN';
        html += `<option value="${f._id}">${f.name} (${deptCode})</option>`;
      });
      assignSelect.innerHTML = html;
    }
  }
}

// --- LEAVE MANAGEMENT ---
async function loadAdminLeaves() {
  const tableBody = document.getElementById('admin-leaves-table-body');
  const statusFilter = document.getElementById('admin-status-filter');
  const deptFilter = document.getElementById('admin-dept-filter');

  if (!tableBody) return;

  let queryParams = [];
  if (statusFilter && statusFilter.value) queryParams.push(`status=${statusFilter.value}`);
  if (deptFilter && deptFilter.value) queryParams.push(`departmentId=${deptFilter.value}`);

  let endpoint = '/leaves';
  if (queryParams.length > 0) endpoint += `?${queryParams.join('&')}`;

  const result = await apiFetch(endpoint);
  if (result.ok && result.data.success) {
    const leaves = result.data.data;
    
    if (leaves.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: #94a3b8; padding: 24px;">
            No leave requests match the selected filters.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    leaves.forEach((leave) => {
      const studentName = leave.studentId ? leave.studentId.name : 'Unknown Student';
      const deptCode = leave.departmentId ? leave.departmentId.code : 'GEN';
      const fromFormatted = new Date(leave.fromDate).toLocaleDateString();
      const toFormatted = new Date(leave.toDate).toLocaleDateString();
      const statusBadge = getStatusBadge(leave.status);
      
      const fileLink = leave.supportingDocument
        ? `<button type="button" class="btn" style="padding: 2px 8px; font-size: 0.75rem; background: rgba(99, 102, 241, 0.2); color: #818cf8; border: none; cursor: pointer; text-decoration: underline;" onclick="viewAuthenticatedFile('/leaves/${leave._id}/download')">📄 View File</button>`
        : '<span style="color: #64748b;">None</span>';

      html += `
        <tr>
          <td style="font-weight: 600; color: #f8fafc;">${studentName}</td>
          <td><span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8;">${deptCode}</span></td>
          <td>${leave.leaveType}</td>
          <td>${fromFormatted} to ${toFormatted}</td>
          <td>${fileLink}</td>
          <td>${statusBadge}</td>
          <td style="color: #cbd5e1; font-size: 0.85rem;">${leave.reviewerRemarks || '<em>No remarks</em>'}</td>
          <td>
            <button class="btn" style="padding: 4px 12px; font-size: 0.75rem; background: rgba(245, 158, 11, 0.2); color: #fbbf24;" onclick="openAdminReviewModal('${leave._id}', '${studentName}', '${deptCode}', '${leave.leaveType}', '${fromFormatted}', '${toFormatted}', '${encodeURIComponent(leave.reason)}', '${leave.supportingDocument}', '${leave.status}', '${encodeURIComponent(leave.reviewerRemarks || '')}')">
              Review / Override
            </button>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }
}

function openAdminReviewModal(leaveId, studentName, deptCode, leaveType, fromDate, toDate, encodedReason, docPath, currentStatus, encodedRemarks) {
  activeAdminReviewLeaveId = leaveId;
  const reason = decodeURIComponent(encodedReason);
  const remarks = decodeURIComponent(encodedRemarks);

  document.getElementById('admin-review-student-name').textContent = `${studentName} (${deptCode})`;
  document.getElementById('admin-review-leave-type').textContent = leaveType;
  document.getElementById('admin-review-dates').textContent = `${fromDate} to ${toDate}`;
  document.getElementById('admin-review-reason').textContent = reason;
  document.getElementById('adminReviewerRemarks').value = remarks;

  const docContainer = document.getElementById('admin-review-doc-container');
  if (docPath) {
    docContainer.innerHTML = `<button type="button" class="btn" style="padding: 4px 12px; font-size: 0.8rem; background: rgba(99, 102, 241, 0.2); color: #818cf8; border: none; cursor: pointer; text-decoration: underline;" onclick="viewAuthenticatedFile('/leaves/${leaveId}/download')">📄 View Attachment</button>`;
  } else {
    docContainer.innerHTML = '<span style="color: #64748b;">No document attached</span>';
  }

  const modal = document.getElementById('admin-review-leave-modal');
  if (modal) modal.classList.add('active');
}

function closeAdminReviewModal() {
  activeAdminReviewLeaveId = null;
  const modal = document.getElementById('admin-review-leave-modal');
  if (modal) modal.classList.remove('active');
}

async function processAdminLeave(status) {
  if (!activeAdminReviewLeaveId) return;

  const remarks = document.getElementById('adminReviewerRemarks').value;
  const alertBox = document.getElementById('admin-review-alert');

  const result = await apiFetch(`/leaves/${activeAdminReviewLeaveId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reviewerRemarks: remarks })
  });

  if (result.ok && result.data.success) {
    closeAdminReviewModal();
    loadAdminLeaves();
    fetchSystemMetrics();
  } else {
    alertBox.textContent = result.data.message || 'Failed to update leave request status.';
    alertBox.className = 'alert-box alert-danger';
    alertBox.style.display = 'block';
  }
}

// --- CAMPUS ISSUES MANAGEMENT ---
async function loadAdminIssues() {
  const tableBody = document.getElementById('admin-issues-table-body');
  const statusFilter = document.getElementById('admin-issue-status-filter');
  const categoryFilter = document.getElementById('admin-issue-category-filter');

  if (!tableBody) return;

  let queryParams = [];
  if (statusFilter && statusFilter.value) queryParams.push(`status=${statusFilter.value}`);
  if (categoryFilter && categoryFilter.value) queryParams.push(`category=${categoryFilter.value}`);

  let endpoint = '/issues';
  if (queryParams.length > 0) endpoint += `?${queryParams.join('&')}`;

  const result = await apiFetch(endpoint);
  if (result.ok && result.data.success) {
    const issues = result.data.data;
    
    if (issues.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: #94a3b8; padding: 24px;">
            No campus issues match the selected filters.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    issues.forEach((issue) => {
      const reporterName = issue.studentId ? issue.studentId.name : 'Unknown';
      const deptCode = issue.departmentId ? issue.departmentId.code : 'GEN';
      const assignedName = issue.assignedTo ? issue.assignedTo.name : '<span style="color: #f59e0b; font-weight: 600;">Unassigned</span>';
      const statusBadge = getIssueStatusBadge(issue.status);

      const imgLink = issue.image
        ? `<a href="http://localhost:5000/${issue.image}" target="_blank" style="color: #818cf8; text-decoration: underline;">📷 Photo</a>`
        : '<span style="color: #64748b;">None</span>';

      const actionBtn = issue.status === 'Resolved'
        ? `<button class="btn" style="padding: 4px 10px; font-size: 0.75rem; background: rgba(16, 185, 129, 0.2); color: #34d399;" onclick="openCloseIssueModal('${issue._id}', '${issue.title}')">Close Issue</button>`
        : `<button class="btn" style="padding: 4px 10px; font-size: 0.75rem; background: rgba(99, 102, 241, 0.2); color: #818cf8;" onclick="openAssignIssueModal('${issue._id}', '${issue.title}')">Assign Faculty</button>`;

      html += `
        <tr>
          <td style="font-weight: 600; color: #f8fafc;">${issue.title} <br><span class="badge" style="font-size: 0.7rem; background: rgba(99, 102, 241, 0.15); color: #818cf8;">${issue.category}</span></td>
          <td>${reporterName} (${deptCode})</td>
          <td>${issue.location}</td>
          <td>${assignedName}</td>
          <td>${imgLink}</td>
          <td>${statusBadge}</td>
          <td style="color: #cbd5e1; font-size: 0.85rem;">${issue.resolutionRemarks || '<em>No remarks</em>'}</td>
          <td>${actionBtn}</td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;
  }
}

function openAssignIssueModal(issueId, title) {
  activeAdminAssignIssueId = issueId;
  document.getElementById('assign-issue-title-text').textContent = title;
  const modal = document.getElementById('admin-assign-issue-modal');
  if (modal) modal.classList.add('active');
}

function closeAssignIssueModal() {
  activeAdminAssignIssueId = null;
  const modal = document.getElementById('admin-assign-issue-modal');
  if (modal) modal.classList.remove('active');
}

async function submitAdminAssignIssue() {
  if (!activeAdminAssignIssueId) return;

  const assignedTo = document.getElementById('assignFacultySelect').value;
  const alertBox = document.getElementById('admin-assign-alert');

  if (!assignedTo) {
    alertBox.textContent = 'Please select a faculty member to assign.';
    alertBox.className = 'alert-box alert-danger';
    alertBox.style.display = 'block';
    return;
  }

  const result = await apiFetch(`/issues/${activeAdminAssignIssueId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ assignedTo })
  });

  if (result.ok && result.data.success) {
    closeAssignIssueModal();
    loadAdminIssues();
    fetchSystemMetrics();
  } else {
    alertBox.textContent = result.data.message || 'Failed to assign issue.';
    alertBox.className = 'alert-box alert-danger';
    alertBox.style.display = 'block';
  }
}

function openCloseIssueModal(issueId, title) {
  activeAdminCloseIssueId = issueId;
  document.getElementById('close-issue-title-text').textContent = title;
  const modal = document.getElementById('admin-close-issue-modal');
  if (modal) modal.classList.add('active');
}

function closeCloseIssueModal() {
  activeAdminCloseIssueId = null;
  const modal = document.getElementById('admin-close-issue-modal');
  if (modal) modal.classList.remove('active');
}

async function submitAdminCloseIssue() {
  if (!activeAdminCloseIssueId) return;

  const remarks = document.getElementById('adminCloseRemarks').value;
  const alertBox = document.getElementById('admin-close-alert');

  const result = await apiFetch(`/issues/${activeAdminCloseIssueId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Closed', resolutionRemarks: remarks })
  });

  if (result.ok && result.data.success) {
    closeCloseIssueModal();
    loadAdminIssues();
    fetchSystemMetrics();
  } else {
    alertBox.textContent = result.data.message || 'Failed to close issue.';
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
