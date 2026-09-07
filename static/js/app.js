/**
 * News Aggregator - Frontend Application Logic
 * --------------------------------------------
 * Handles API fetching, DOM rendering, category switching, keyword search,
 * source filtering, sorting, bookmarks (localStorage), and dark mode.
 */

// Global Application State
const state = {
  category: "general",
  query: "",
  country: "us",
  source: "all",
  sortBy: "newest",
  apiKey: localStorage.getItem("news_aggregator_api_key") || "",
  articles: [],
  sources: [],
  bookmarks: JSON.parse(localStorage.getItem("news_bookmarks") || "[]")
};

// DOM Elements Cache
const elements = {
  newsGrid: document.getElementById("newsGrid"),
  sectionHeading: document.getElementById("sectionHeading"),
  resultsCount: document.getElementById("resultsCount"),
  providerBadge: document.getElementById("providerBadge"),
  providerText: document.getElementById("providerText"),
  refreshBtn: document.getElementById("refreshBtn"),
  
  // Search
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  searchClearBtn: document.getElementById("searchClearBtn"),
  
  // Filters
  categoryContainer: document.getElementById("categoryContainer"),
  categoryButtons: document.querySelectorAll(".cat-btn"),
  countrySelect: document.getElementById("countrySelect"),
  sourceSelect: document.getElementById("sourceSelect"),
  sortSelect: document.getElementById("sortSelect"),
  
  // Theme & Bookmarks
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  bookmarksBtn: document.getElementById("bookmarksBtn"),
  bookmarkCount: document.getElementById("bookmarkCount"),
  bookmarksModal: document.getElementById("bookmarksModal"),
  bookmarksList: document.getElementById("bookmarksList"),
  clearAllBookmarksBtn: document.getElementById("clearAllBookmarksBtn"),
  
  // Settings Modal (3 to 4 Keys)
  settingsBtn: document.getElementById("settingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  apiKeyInputs: [
    document.getElementById("apiKeyInput1"),
    document.getElementById("apiKeyInput2"),
    document.getElementById("apiKeyInput3"),
    document.getElementById("apiKeyInput4")
  ],
  saveApiKeyBtn: document.getElementById("saveApiKeyBtn"),
  resetApiKeyBtn: document.getElementById("resetApiKeyBtn"),
  
  toastContainer: document.getElementById("toastContainer")
};

/* ==========================================================================
   1. Initial Setup & Event Listeners
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  updateBookmarkCounter();
  setupEventListeners();
  loadKeyPoolStatus();

  // Initial fetch
  fetchNews();
});

function setupEventListeners() {
  // Category selection
  elements.categoryContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    
    elements.categoryButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    
    state.category = btn.getAttribute("data-category");
    state.query = "";
    elements.searchInput.value = "";
    elements.searchClearBtn.style.display = "none";
    
    fetchNews();
  });

  // Search submission
  elements.searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = elements.searchInput.value.trim();
    if (query) {
      state.query = query;
      elements.searchClearBtn.style.display = "inline-block";
      fetchNews();
    }
  });

  // Search input typing - show/hide clear button
  elements.searchInput.addEventListener("input", () => {
    if (elements.searchInput.value.trim().length > 0) {
      elements.searchClearBtn.style.display = "inline-block";
    } else {
      elements.searchClearBtn.style.display = "none";
      if (state.query) {
        state.query = "";
        fetchNews();
      }
    }
  });

  // Clear search
  elements.searchClearBtn.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.searchClearBtn.style.display = "none";
    if (state.query) {
      state.query = "";
      fetchNews();
    }
  });

  // Country select filter
  elements.countrySelect.addEventListener("change", (e) => {
    state.country = e.target.value;
    fetchNews();
  });

  // News source filter
  elements.sourceSelect.addEventListener("change", (e) => {
    state.source = e.target.value;
    filterAndRenderArticles();
  });

  // Sorting filter
  elements.sortSelect.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    filterAndRenderArticles();
  });

  // Refresh button
  elements.refreshBtn.addEventListener("click", () => {
    fetchNews();
    showToast("News refreshed successfully!");
  });

  // Theme Toggle (Dark / Light)
  elements.themeToggleBtn.addEventListener("click", toggleTheme);

  // Bookmarks Modal
  elements.bookmarksBtn.addEventListener("click", openBookmarksModal);
  elements.clearAllBookmarksBtn.addEventListener("click", clearAllBookmarks);

  // Settings Modal
  elements.settingsBtn.addEventListener("click", () => {
    elements.settingsModal.classList.add("active");
  });

  elements.saveApiKeyBtn.addEventListener("click", saveAllApiKeys);
  elements.resetApiKeyBtn.addEventListener("click", resetToFreeMode);

  // Modal Close buttons (by data-close-modal attribute or backdrop click)
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".modal-backdrop").forEach((m) => m.classList.remove("active"));
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove("active");
      }
    });
  });
}

/* ==========================================================================
   2. Data Fetching & API Communication
   ========================================================================== */
async function fetchNews() {
  renderSkeletons();
  updateSectionHeading();

  const params = new URLSearchParams({
    category: state.category,
    q: state.query,
    country: state.country,
    sort_by: state.sortBy,
    limit: "24"
  });

  if (state.apiKey) {
    params.append("api_key", state.apiKey);
  }

  try {
    const response = await fetch(`/api/news?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "success") {
      state.articles = data.articles || [];
      state.sources = data.sources || [];

      // Update provider indicator
      elements.providerText.textContent = data.provider || "Free Live Feed";
      if (data.key_pool && data.key_pool.total_keys > 0) {
        elements.providerBadge.title = `Key Pool (${data.key_pool.total_keys} keys): ${data.key_pool.all_masked.join(", ")}`;
      } else {
        elements.providerBadge.title = "Live Global Feed (No API key needed)";
      }

      // Populate source filter dropdown
      populateSourceDropdown(state.sources);

      // Render cards
      filterAndRenderArticles();
    } else {
      renderError("Failed to retrieve news. Please try again.");
    }
  } catch (error) {
    console.error("Fetch news error:", error);
    renderError("Network error occurred while fetching news. Please check your connection.");
  }
}

/* ==========================================================================
   3. Filtering, Sorting & Rendering
   ========================================================================== */
function filterAndRenderArticles() {
  let list = [...state.articles];

  // 1. Source filtering
  if (state.source && state.source !== "all") {
    list = list.filter((a) => a.source.toLowerCase() === state.source.toLowerCase());
  }

  // 2. Client-side sorting
  if (state.sortBy === "oldest") {
    list.sort((a, b) => new Date(a.published_at_raw) - new Date(b.published_at_raw));
  } else if (state.sortBy === "title") {
    list.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // Newest first
    list.sort((a, b) => new Date(b.published_at_raw) - new Date(a.published_at_raw));
  }

  elements.resultsCount.textContent = `Showing ${list.length} articles`;

  if (list.length === 0) {
    renderEmpty();
    return;
  }

  elements.newsGrid.innerHTML = list.map((article, index) => createNewsCardHTML(article, index)).join("");

  // Attach card event listeners (image errors, bookmarks)
  attachCardEvents();
}

function createNewsCardHTML(article, index) {
  const isSaved = state.bookmarks.some((b) => b.url === article.url);
  const bookmarkIcon = isSaved ? "★" : "☆";
  const bookmarkClass = isSaved ? "saved" : "";

  // Sentiment formatting
  const sentiment = article.sentiment || { label: "Neutral", badge_class: "badge-neutral" };
  const sentimentIcon = sentiment.label === "Positive" ? "🟢" : sentiment.label === "Negative" ? "🔴" : "⚪";

  return `
    <article class="news-card" data-index="${index}">
      <div class="card-media">
        <img 
          class="card-img" 
          src="${escapeHTML(article.image_url)}" 
          alt="${escapeHTML(article.title)}" 
          loading="lazy"
          onerror="this.onerror=null; this.src='/static/images/placeholder.svg';"
        >
        <div class="media-badges">
          <span class="source-badge">${escapeHTML(article.source || "News")}</span>
          <span class="category-tag">${escapeHTML(article.category || state.category)}</span>
        </div>
        <button 
          type="button" 
          class="bookmark-icon-btn ${bookmarkClass}" 
          data-action="bookmark" 
          data-url="${escapeHTML(article.url)}" 
          title="${isSaved ? "Remove Bookmark" : "Save Article"}"
        >
          ${bookmarkIcon}
        </button>
      </div>

      <div class="card-body">
        <div class="card-meta">
          <span class="card-time" title="${escapeHTML(article.published_at)}">
            🕒 ${escapeHTML(article.time_ago || "Recent")}
          </span>
          <span class="badge-sentiment ${sentiment.badge_class}" title="AI Tone: ${sentiment.label}">
            ${sentimentIcon} ${sentiment.label}
          </span>
        </div>

        <h3 class="card-title" title="${escapeHTML(article.title)}">
          ${escapeHTML(article.title)}
        </h3>

        <p class="card-description">
          ${escapeHTML(article.description || "Click below to read the complete coverage.")}
        </p>

        <div class="card-footer">
          <span style="font-size: 0.75rem; color: var(--text-dim);">${escapeHTML(article.source)}</span>
          <a 
            href="${escapeHTML(article.url)}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="read-more-link"
          >
            Read Article &rarr;
          </a>
        </div>
      </div>
    </article>
  `;
}

function attachCardEvents() {
  const bookmarkButtons = elements.newsGrid.querySelectorAll('[data-action="bookmark"]');
  bookmarkButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const articleUrl = btn.getAttribute("data-url");
      const article = state.articles.find((a) => a.url === articleUrl);
      if (article) {
        toggleBookmark(article);
      }
    });
  });
}

function populateSourceDropdown(sources) {
  const currentVal = elements.sourceSelect.value;
  elements.sourceSelect.innerHTML = '<option value="all">All Sources</option>';

  sources.forEach((src) => {
    const opt = document.createElement("option");
    opt.value = src;
    opt.textContent = src;
    elements.sourceSelect.appendChild(opt);
  });

  if (sources.includes(currentVal)) {
    elements.sourceSelect.value = currentVal;
  } else {
    elements.sourceSelect.value = "all";
    state.source = "all";
  }
}

function updateSectionHeading() {
  if (state.query) {
    elements.sectionHeading.innerHTML = `<span>Results for: "${escapeHTML(state.query)}"</span>`;
  } else {
    const categoryName = state.category.charAt(0).toUpperCase() + state.category.slice(1);
    elements.sectionHeading.innerHTML = `<span>${categoryName} Headlines</span>`;
  }
}

/* ==========================================================================
   4. Loading, Empty & Error UI States
   ========================================================================== */
function renderSkeletons() {
  elements.resultsCount.textContent = "Fetching latest articles...";
  const skeletonCards = Array(6)
    .fill(0)
    .map(
      () => `
      <div class="skeleton-card">
        <div class="skeleton-media"></div>
        <div class="skeleton-body">
          <div class="skeleton-line sub"></div>
          <div class="skeleton-line title"></div>
          <div class="skeleton-line desc1"></div>
          <div class="skeleton-line desc2"></div>
        </div>
      </div>
    `
    )
    .join("");
  elements.newsGrid.innerHTML = skeletonCards;
}

function renderEmpty() {
  elements.newsGrid.innerHTML = `
    <div class="state-container">
      <div class="state-icon">🔍</div>
      <h3 class="state-title">No Articles Found</h3>
      <p class="state-desc">We couldn't find any articles matching your search or filters. Try adjusting keywords or category.</p>
      <button class="btn-primary" onclick="resetFilters()">Reset All Filters</button>
    </div>
  `;
}

function renderError(message) {
  elements.newsGrid.innerHTML = `
    <div class="state-container">
      <div class="state-icon">⚠️</div>
      <h3 class="state-title">Unable to Load News</h3>
      <p class="state-desc">${escapeHTML(message)}</p>
      <button class="btn-primary" onclick="fetchNews()">Retry Loading</button>
    </div>
  `;
}

function resetFilters() {
  state.query = "";
  state.category = "general";
  state.source = "all";
  state.sortBy = "newest";
  elements.searchInput.value = "";
  elements.searchClearBtn.style.display = "none";
  elements.categoryButtons.forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-category") === "general");
  });
  elements.sourceSelect.value = "all";
  elements.sortSelect.value = "newest";
  fetchNews();
}

/* ==========================================================================
   5. Bookmarks Management (localStorage)
   ========================================================================== */
function toggleBookmark(article) {
  const existingIdx = state.bookmarks.findIndex((b) => b.url === article.url);

  if (existingIdx > -1) {
    state.bookmarks.splice(existingIdx, 1);
    showToast("Article removed from bookmarks");
  } else {
    state.bookmarks.unshift({
      title: article.title,
      url: article.url,
      image_url: article.image_url,
      source: article.source,
      published_at: article.published_at,
      time_ago: article.time_ago
    });
    showToast("Article saved to bookmarks! 🔖");
  }

  localStorage.setItem("news_bookmarks", JSON.stringify(state.bookmarks));
  updateBookmarkCounter();
  filterAndRenderArticles();
}

function updateBookmarkCounter() {
  elements.bookmarkCount.textContent = state.bookmarks.length;
}

function openBookmarksModal() {
  renderBookmarksList();
  elements.bookmarksModal.classList.add("active");
}

function renderBookmarksList() {
  if (state.bookmarks.length === 0) {
    elements.bookmarksList.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
        <p style="font-size: 2rem; margin-bottom: 0.5rem;">📭</p>
        <p>No saved bookmarks yet.</p>
        <p style="font-size: 0.8rem; color: var(--text-dim);">Click the star/bookmark icon on any card to save it for later.</p>
      </div>
    `;
    return;
  }

  elements.bookmarksList.innerHTML = state.bookmarks
    .map(
      (b, idx) => `
      <div class="bookmark-item">
        <img src="${escapeHTML(b.image_url)}" class="bookmark-thumb" alt="" onerror="this.src='/static/images/placeholder.svg';">
        <div class="bookmark-info">
          <a href="${escapeHTML(b.url)}" target="_blank" rel="noopener noreferrer" class="bookmark-title">
            ${escapeHTML(b.title)}
          </a>
          <div class="bookmark-meta">
            ${escapeHTML(b.source)} &bull; ${escapeHTML(b.time_ago || "Saved")}
          </div>
        </div>
        <button class="bookmark-del-btn" onclick="removeBookmark(${idx})" title="Remove bookmark">
          🗑️
        </button>
      </div>
    `
    )
    .join("");
}

window.removeBookmark = function (idx) {
  state.bookmarks.splice(idx, 1);
  localStorage.setItem("news_bookmarks", JSON.stringify(state.bookmarks));
  updateBookmarkCounter();
  renderBookmarksList();
  filterAndRenderArticles();
  showToast("Bookmark removed");
};

function clearAllBookmarks() {
  if (state.bookmarks.length === 0) return;
  if (confirm("Are you sure you want to remove all saved bookmarks?")) {
    state.bookmarks = [];
    localStorage.removeItem("news_bookmarks");
    updateBookmarkCounter();
    renderBookmarksList();
    filterAndRenderArticles();
    showToast("All bookmarks cleared");
  }
}

/* ==========================================================================
   6. API Settings & Multi-Key Pool Handling
   ========================================================================== */
async function loadKeyPoolStatus() {
  try {
    const res = await fetch("/api/keys");
    const data = await res.json();
    if (data.pool && data.pool.masked_keys) {
      data.pool.masked_keys.forEach((masked, idx) => {
        if (elements.apiKeyInputs[idx] && masked !== "********") {
          elements.apiKeyInputs[idx].placeholder = masked;
        }
      });
    }
  } catch (err) {
    console.warn("Could not load API key pool status:", err);
  }
}

async function saveAllApiKeys() {
  const enteredKeys = elements.apiKeyInputs
    .map((input) => input.value.trim())
    .filter((k) => k.length > 0);

  if (enteredKeys.length === 0) {
    alert("Please enter at least 1 API key or click 'Use Free Live Feed'.");
    return;
  }

  try {
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: enteredKeys })
    });

    const data = await res.json();
    if (data.status === "success") {
      elements.settingsModal.classList.remove("active");
      showToast(`Saved ${enteredKeys.length} keys in rotation pool! 🔑`);
      // Clear values and update placeholders with masked strings
      elements.apiKeyInputs.forEach((input) => {
        input.value = "";
      });
      loadKeyPoolStatus();
      fetchNews();
    }
  } catch (err) {
    showToast("Failed to save keys to server");
  }
}

async function resetToFreeMode() {
  try {
    await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: [] })
    });
    elements.apiKeyInputs.forEach((input) => {
      input.value = "";
      input.placeholder = "Empty";
    });
    elements.settingsModal.classList.remove("active");
    showToast("Switched to Free Live Feed!");
    fetchNews();
  } catch (err) {
    showToast("Failed to reset API keys");
  }
}

/* ==========================================================================
   7. Theme Toggle (Dark / Light)
   ========================================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem("news_theme");
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.setAttribute("data-theme", "dark");
    updateThemeIcon("dark");
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("news_theme", next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  elements.themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
}

/* ==========================================================================
   8. Utility Functions
   ========================================================================== */
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>🔔</span> <span>${escapeHTML(message)}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
