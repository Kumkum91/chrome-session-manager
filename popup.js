
document.addEventListener("DOMContentLoaded", () => {

  const saveViewBtn = document.getElementById("saveViewBtn");
  const sessionsViewBtn = document.getElementById("sessionsViewBtn");
  const tabsList = document.getElementById("tabsList");
  const saveView = document.getElementById("saveView");
  const sessionsView = document.getElementById("sessionsView");

  // SWITCH VIEW
  saveViewBtn.onclick = () => {
    saveView.style.display = "block";
    sessionsView.style.display = "none";
    saveViewBtn.classList.add("active");
    sessionsViewBtn.classList.remove("active");
  };

  sessionsViewBtn.onclick = () => {
    saveView.style.display = "none";
    sessionsView.style.display = "block";
    saveViewBtn.classList.remove("active");
    sessionsViewBtn.classList.add("active");
    loadSessions();
  };

  // ========================
  // RENDER TABS (SELECTABLE)
  // ========================
  function renderTabs(tabs) {
    tabsList.innerHTML = "";

    tabs.forEach(tab => {
      const div = document.createElement("div");
      div.className = "tab-item";

      div.innerHTML = `
        <input type="checkbox" value="${tab.url}">
        <img src="${tab.favIconUrl || ''}">
        <span title="${tab.title}">${tab.title}</span>
      `;

      const checkbox = div.querySelector("input");

      div.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT") {
          checkbox.checked = !checkbox.checked;
        }
        div.classList.toggle("selected", checkbox.checked);
      });

      checkbox.addEventListener("change", () => {
        div.classList.toggle("selected", checkbox.checked);
      });

      tabsList.appendChild(div);
    });
  }

  chrome.tabs.query({}, renderTabs);

  // ========================
  // SAVE SESSION
  // ========================
  document.getElementById("saveBtn").addEventListener("click", () => {
    const name = document.getElementById("sessionName").value;

    const selectedTabs = Array.from(
      document.querySelectorAll("#tabsList input[type='checkbox']:checked")
    ).map(cb => {
      const tabItem = cb.parentElement;
      const img = tabItem.querySelector("img");

      return {
        url: cb.value,
        icon: img.src
      };
    });

    if (!name || selectedTabs.length === 0) {
      showToast("Enter name and select tabs!");
      return;
    }

    const session = {
      name,
      tabs: selectedTabs,
      time: new Date().toISOString()
    };

    chrome.storage.local.get("sessions", (data) => {
      const sessions = data.sessions || [];
      sessions.push(session);

      chrome.storage.local.set({ sessions }, () => {
        showToast("Session saved!");
        document.getElementById("sessionName").value = "";
        chrome.tabs.query({}, renderTabs);
      });
    });
  });

  // ========================
  // LOAD SESSIONS
  // ========================
  function loadSessions() {
    const container = document.getElementById("sessionsList");
    const emptyState = document.getElementById("emptyState");
    const search = document.getElementById("searchBox").value.toLowerCase();

    container.innerHTML = "";

    chrome.storage.local.get("sessions", (data) => {
      const sessions = data.sessions || [];

      if (!sessions.length) {
        emptyState.style.display = "block";
        return;
      } else {
        emptyState.style.display = "none";
      }

      sessions.slice().reverse().forEach((session, index) => {

        if (!session.name.toLowerCase().includes(search)) return;

        const div = document.createElement("div");
        div.className = "session-card";

        const maxTabs = 3;
        const extraCount = session.tabs.length - maxTabs;

        const tabsHTML = session.tabs.slice(0, maxTabs).map(tab => {
          let name = "";
          try {
            name = new URL(tab.url).hostname.replace("www.", "");
          } catch {
            name = "tab";
          }

          return `
            <div class="tab-chip">
              <img src="${tab.icon || ''}">
              <span>${name}</span>
            </div>
          `;
        }).join("");

        const moreButton = extraCount > 0 
          ? `<div class="more-tabs" data-index="${index}">+${extraCount} more</div>` 
          : "";

        div.innerHTML = `
          <div class="session-title">${session.name}</div>
          <div class="session-time">${timeAgo(session.time)}</div>

          <div class="session-tabs" id="tabs-${index}">
            ${tabsHTML}
            ${moreButton}
          </div>

          <div class="actions">
            <button class="btn restore" data-restore="${index}">↻ Restore</button>
            <button class="btn delete" data-delete="${index}">Delete</button>
          </div>
        `;

        container.appendChild(div);
      });

      addSessionListeners(sessions);

      // EXPAND
      document.querySelectorAll(".more-tabs").forEach(btn => {
        btn.onclick = () => {
          const index = btn.dataset.index;
          const session = sessions[sessions.length - 1 - index];
          const container = document.getElementById(`tabs-${index}`);

          container.innerHTML = session.tabs.map(tab => {
            let name = "";
            try {
              name = new URL(tab.url).hostname.replace("www.", "");
            } catch {
              name = "tab";
            }

            return `
              <div class="tab-chip">
                <img src="${tab.icon || ''}">
                <span>${name}</span>
              </div>
            `;
          }).join("") + `<div class="less-tabs" data-index="${index}">Show less</div>`;
        };
      });
    });
  }

  // COLLAPSE
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("less-tabs")) {
      loadSessions();
    }
  });

  // RESTORE & DELETE
  function addSessionListeners(sessions) {
    document.querySelectorAll("[data-restore]").forEach(btn => {
      btn.onclick = () => {
        const index = btn.dataset.restore;
        const session = sessions[sessions.length - 1 - index];

        session.tabs.forEach(tab => {
          chrome.tabs.create({ url: tab.url });
        });
      };
    });

    document.querySelectorAll("[data-delete]").forEach(btn => {
      btn.onclick = () => {
        const index = btn.dataset.delete;

        chrome.storage.local.get("sessions", (data) => {
          let sessions = data.sessions || [];
          sessions.splice(sessions.length - 1 - index, 1);

          chrome.storage.local.set({ sessions }, loadSessions);
        });
      };
    });
  }

  // TIME
  function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);

    const intervals = [
      { label: "year", value: 31536000 },
      { label: "month", value: 2592000 },
      { label: "day", value: 86400 },
      { label: "hour", value: 3600 },
      { label: "minute", value: 60 }
    ];

    for (let i of intervals) {
      const count = Math.floor(seconds / i.value);
      if (count >= 1) {
        return `${count} ${i.label}${count > 1 ? "s" : ""} ago`;
      }
    }

    return "just now";
  }

  document.getElementById("searchBox").addEventListener("input", loadSessions);

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.innerText = msg;
    toast.className = "toast";

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

});