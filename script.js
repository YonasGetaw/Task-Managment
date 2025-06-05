class TaskManager {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        this.currentFilter = 'all';
        this.currentSort = 'time';
        this.darkMode = localStorage.getItem('darkMode') === 'true';
        this.notificationTimeouts = {};
        this.notificationCheckInterval = null;

        this.initElements();
        this.initEventListeners();
        this.setDefaultDateTime();
        this.updateUI();
        this.startNotificationChecker();
    }

    initElements() {
        this.taskForm = document.getElementById('task-form');
        this.taskInput = document.getElementById('task-input');
        this.taskTime = document.getElementById('task-time');
        this.taskDate = document.getElementById('task-date');
        this.taskPriority = document.getElementById('task-priority');
        this.enableNotification = document.getElementById('enable-notification');
        this.errorMsg = document.getElementById('error-msg');
        this.tasksContainer = document.getElementById('tasks-container');
        this.emptyState = document.getElementById('empty-state');
        this.taskCounter = document.getElementById('task-counter');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.sortSelect = document.getElementById('sort-select');
        this.themeToggle = document.getElementById('theme-toggle');
        this.currentDate = document.getElementById('current-date');
        this.notificationContainer = document.getElementById('notification-container');
    }

    initEventListeners() {
        this.taskForm.addEventListener('submit', (e) => this.handleAddTask(e));
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => this.handleFilterChange(btn.dataset.filter));
        });
        this.sortSelect.addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.updateTaskList();
        });
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    setDefaultDateTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        this.taskTime.value = `${hours}:${minutes}`;

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        this.taskDate.value = `${year}-${month}-${day}`;
    }

    updateUI() {
        this.updateTaskList();
        this.updateTaskCounter();
        this.updateTheme();
        this.updateDate();
        this.scheduleNotifications();
    }

    updateDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        this.currentDate.textContent = new Date().toLocaleDateString(undefined, options);
    }

    toggleTheme() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('darkMode', this.darkMode);
        document.body.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
        this.themeToggle.innerHTML = this.darkMode ?
            '<i class="fas fa-sun"></i>' :
            '<i class="fas fa-moon"></i>';
    }

    updateTheme() {
        if (this.darkMode) {
            document.body.setAttribute('data-theme', 'dark');
            this.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            document.body.removeAttribute('data-theme');
            this.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }

    handleAddTask(e) {
        e.preventDefault();
        const taskText = this.taskInput.value.trim();
        const taskTime = this.taskTime.value;
        const taskDate = this.taskDate.value;
        const priority = this.taskPriority.value;
        const enableNotification = this.enableNotification.checked;

        if (!taskText) {
            this.errorMsg.textContent = 'Please enter a task';
            this.taskInput.classList.add('error');
            return;
        }

        const newTask = {
            id: Date.now(),
            text: taskText,
            time: taskTime,
            date: taskDate,
            priority,
            enableNotification,
            completed: false,
            createdAt: new Date().toISOString(),
            notified: false
        };

        this.tasks.unshift(newTask);
        this.saveTasks();
        this.updateUI();

        this.taskInput.value = '';
        this.taskInput.focus();
        this.errorMsg.textContent = '';
        this.taskInput.classList.remove('error');

        this.showNotification('Task added', 'Your task has been successfully added.', 'success');
    }

    handleFilterChange(filter) {
        this.currentFilter = filter;
        this.filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        this.updateTaskList();
    }

    toggleTaskStatus(taskId) {
        this.tasks = this.tasks.map(task =>
            task.id === taskId ? {...task, completed: !task.completed } : task
        );
        this.saveTasks();
        this.updateUI();

        const task = this.tasks.find(t => t.id === taskId);
        if (task.completed) {
            this.showNotification('Task completed', `"${task.text}" has been marked as completed.`, 'success');
        }
    }

    deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveTasks();
        this.updateUI();
        this.showNotification('Task deleted', `"${task.text}" has been removed.`, 'error');

        // Clear any scheduled notification for this task
        if (this.notificationTimeouts[taskId]) {
            clearTimeout(this.notificationTimeouts[taskId]);
            delete this.notificationTimeouts[taskId];
        }
    }

    saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    updateTaskCounter() {
            const pendingCount = this.tasks.filter(task => !task.completed).length;
            const totalCount = this.tasks.length;
            const overdueCount = this.tasks.filter(task => this.isTaskOverdue(task) && !task.completed).length;
            this.taskCounter.textContent = `${pendingCount}/${totalCount} tasks${overdueCount > 0 ? ` (${overdueCount} overdue)` : ''}`;
  }
  
  updateTaskList() {
    const filteredTasks = this.filterTasks();
    const sortedTasks = this.sortTasks(filteredTasks);
    this.renderTasks(sortedTasks);
  }
  
  filterTasks() {
    const now = new Date();
    return this.tasks.filter(task => {
      if (this.currentFilter === 'active') return !task.completed;
      if (this.currentFilter === 'completed') return task.completed;
      if (this.currentFilter === 'overdue') return this.isTaskOverdue(task) && !task.completed;
      return true;
    });
  }
  
  isTaskOverdue(task) {
    if (task.completed) return false;
    
    const now = new Date();
    const taskDateTime = this.getTaskDateTime(task);
    return taskDateTime < now;
  }
  
  getTaskDateTime(task) {
    const [year, month, day] = task.date.split('-');
    const [hours, minutes] = task.time.split(':');
    return new Date(year, month - 1, day, hours, minutes);
  }
  
  sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      switch (this.currentSort) {
        case 'time': return a.time.localeCompare(b.time);
        case 'priority': 
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'date':
          const dateA = this.getTaskDateTime(a);
          const dateB = this.getTaskDateTime(b);
          return dateA - dateB;
        default: return 0;
      }
    });
  }
  
  renderTasks(tasks) {
    this.tasksContainer.innerHTML = '';
    
    if (tasks.length === 0) {
      this.emptyState.style.display = 'flex';
      return;
    }
    
    this.emptyState.style.display = 'none';
    
    tasks.forEach(task => {
      const taskElement = this.createTaskElement(task);
      this.tasksContainer.appendChild(taskElement);
    });
  }
  
  createTaskElement(task) {
    const taskElement = document.createElement('div');
    taskElement.className = `task-card ${this.isTaskOverdue(task) ? 'overdue' : ''}`;
    
    const formattedTime = this.formatTime(task.time);
    const formattedDate = this.formatDate(task.date);
    const priorityClass = `priority-${task.priority}`;
    const priorityText = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    
    const isOverdue = this.isTaskOverdue(task);
    const overdueText = isOverdue ? '<span class="priority-tag priority-high">OVERDUE</span>' : '';
    
    taskElement.innerHTML = `
      <input 
        type="checkbox" 
        class="task-checkbox" 
        ${task.completed ? 'checked' : ''}
      >
      <div class="task-content">
        <div class="task-text ${task.completed ? 'completed' : ''}">
          ${task.text}
        </div>
        <div class="task-meta">
          <span class="task-time">
            <i class="far fa-clock"></i> ${formattedTime}
          </span>
          <span class="task-date">
            <i class="far fa-calendar"></i> ${formattedDate}
          </span>
          <span class="priority-tag ${priorityClass}">
            ${priorityText}
          </span>
          ${overdueText}
        </div>
      </div>
      <div class="task-actions">
        <button class="action-btn" aria-label="Delete task">
          <i class="far fa-trash-alt"></i>
        </button>
      </div>
    `;
    
    const checkbox = taskElement.querySelector('.task-checkbox');
    const deleteBtn = taskElement.querySelector('.action-btn');
    
    checkbox.addEventListener('change', () => this.toggleTaskStatus(task.id));
    deleteBtn.addEventListener('click', () => this.deleteTask(task.id));
    
    return taskElement;
  }
  
  formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hourNum = parseInt(hours);
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }
  
  formatDate(date) {
    const options = { month: 'short', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
  }
  
  showNotification(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-icon">
        ${this.getNotificationIcon(type)}
      </div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      notification.remove();
    });
    
    this.notificationContainer.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }
  
  getNotificationIcon(type) {
    switch (type) {
      case 'success': return '<i class="fas fa-check-circle"></i>';
      case 'error': return '<i class="fas fa-exclamation-circle"></i>';
      case 'warning': return '<i class="fas fa-exclamation-triangle"></i>';
      default: return '<i class="fas fa-info-circle"></i>';
    }
  }
  
  scheduleNotifications() {
    // Clear all existing timeouts
    Object.values(this.notificationTimeouts).forEach(timeout => clearTimeout(timeout));
    this.notificationTimeouts = {};
    
    const now = new Date();
    
    this.tasks.forEach(task => {
      if (task.completed || !task.enableNotification || task.notified) return;
      
      const taskDateTime = this.getTaskDateTime(task);
      const timeUntilTask = taskDateTime - now;
      
      if (timeUntilTask > 0) {
        // Schedule notification 1 minute before task time
        const notificationTime = Math.max(timeUntilTask - 60000, 0);
        
        this.notificationTimeouts[task.id] = setTimeout(() => {
          this.showNotification(
            'Task Reminder', 
            `"${task.text}" is due soon (${this.formatTime(task.time)}).`,
            'warning'
          );
          
          // Mark as notified
          task.notified = true;
          this.saveTasks();
        }, notificationTime);
      }
    });
  }
  
  startNotificationChecker() {
    // Check for overdue tasks every minute
    this.notificationCheckInterval = setInterval(() => {
      const now = new Date();
      let hasOverdue = false;
      
      this.tasks.forEach(task => {
        if (!task.completed && this.isTaskOverdue(task) && !task.notified) {
          this.showNotification(
            'Task Overdue', 
            `"${task.text}" is overdue!`,
            'error'
          );
          task.notified = true;
          hasOverdue = true;
        }
      });
      
      if (hasOverdue) {
        this.saveTasks();
        this.updateTaskCounter();
        this.updateTaskList();
      }
    }, 60000); // Check every minute
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Request notification permission
  if ('Notification' in window) {
    Notification.requestPermission();
  }
  
  new TaskManager();
});