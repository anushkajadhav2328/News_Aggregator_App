/**
 * News Aggregator - Client-Side Application Logic (GitHub Pages Compatible)
 * --------------------------------------------------------------------------
 * Pure client-side operation with CORS-friendly news feeds, client-side
 * rule-based sentiment analysis, live keyword search, filtering, sorting,
 * bookmarking (localStorage), and dark mode.
 */

// Sentiment Analysis Vocabulary (Ported from services/news_service.py)
const POSITIVE_WORDS = new Set([
  "surge", "surges", "gain", "gains", "growth", "grew", "boost", "boosts", "record",
  "profit", "profits", "breakthrough", "success", "successful", "win", "wins", "won",
  "positive", "hero", "cure", "recovers", "recovery", "soars", "advance", "advances",
  "thrive", "opportunity", "hope", "optimistic", "praise", "praises", "milestone",
  "celebrate", "triumph", "innovative", "leader", "safe", "peace", "award", "promising",
  "upbeat", "rally", "rallies", "revolution", "achieve", "achievement", "victory"
]);

const NEGATIVE_WORDS = new Set([
  "crash", "crashes", "drop", "drops", "fall", "falls", "loss", "losses", "crisis",
  "fail", "fails", "failed", "failure", "death", "deaths", "dead", "kill", "killed",
  "murder", "war", "conflict", "attack", "attacks", "threat", "danger", "warning",
  "disaster", "scam", "fraud", "arrest", "arrested", "decline", "declines", "injury",
  "ban", "bans", "banned", "lawsuit", "sues", "sued", "strike", "plunge", "plunges",
  "controversy", "recession", "inflation", "protest", "fatal", "damage", "corrupt",
  "tragedy", "tragic", "victim", "victims", "scandal", "bomb", "collapse", "severe"
]);

// Google News Topic Mapping for Categories
const GOOGLE_NEWS_TOPICS = {
  general: "",
  business: "BUSINESS",
  technology: "TECHNOLOGY",
  sports: "SPORTS",
  entertainment: "ENTERTAINMENT",
  health: "HEALTH",
  science: "SCIENCE"
};

// Global Application State
const state = {
  category: "general",
  query: "",
  country: "us",
  source: "all",
  sortBy: "newest",
  apiKey: localStorage.getItem("news_aggregator_custom_key") || "",
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
  
  // Settings Modal
  settingsBtn: document.getElementById("settingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  customApiKeyInput: document.getElementById("customApiKeyInput"),
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

  if (elements.customApiKeyInput && state.apiKey) {
    elements.customApiKeyInput.value = state.apiKey;
  }

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
      elements.searchClearBtn.style.display = "block";
      fetchNews();
    }
  });

  // Search live input clear button
  elements.searchInput.addEventListener("input", (e) => {
    if (e.target.value.trim().length > 0) {
      elements.searchClearBtn.style.display = "block";
    } else {
      elements.searchClearBtn.style.display = "none";
      if (state.query) {
        state.query = "";
        fetchNews();
      }
    }
  });

  elements.searchClearBtn.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.searchClearBtn.style.display = "none";
    if (state.query) {
      state.query = "";
      fetchNews();
    }
    elements.searchInput.focus();
  });

  // Country filter
  elements.countrySelect.addEventListener("change", (e) => {
    state.country = e.target.value;
    fetchNews();
  });

  // Source filter
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
  if (elements.settingsBtn && elements.settingsModal) {
    elements.settingsBtn.addEventListener("click", () => {
      elements.settingsModal.classList.add("active");
    });
  }

  if (elements.saveApiKeyBtn) {
    elements.saveApiKeyBtn.addEventListener("click", saveCustomApiKey);
  }

  if (elements.resetApiKeyBtn) {
    elements.resetApiKeyBtn.addEventListener("click", resetToFreeMode);
  }

  // Modal Close buttons
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
   2. Sentiment Analysis & NLP Helpers
   ========================================================================== */
function analyzeSentiment(text) {
  if (!text) {
    return { label: "Neutral", score: 0.0, badge_class: "badge-neutral" };
  }

  const cleanText = text.toLowerCase().replace(/[^\w\s]/g, " ");
  const words = cleanText.split(/\s+/).filter(Boolean);

  let posCount = 0;
  let negCount = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) posCount++;
    if (NEGATIVE_WORDS.has(word)) negCount++;
  }

  const total = posCount + negCount;
  if (total === 0) {
    return { label: "Neutral", score: 0.0, badge_class: "badge-neutral" };
  }

  const score = Math.round(((posCount - negCount) / Math.max(total, 1)) * 100) / 100;

  if (score > 0.15) {
    return { label: "Positive", score, badge_class: "badge-positive" };
  } else if (score < -0.15) {
    return { label: "Negative", score, badge_class: "badge-negative" };
  } else {
    return { label: "Neutral", score, badge_class: "badge-neutral" };
  }
}

function formatRelativeTime(date) {
  if (!date || isNaN(date.getTime())) return "Recent";
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now - date) / 1000));

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function stripHtml(htmlStr) {
  if (!htmlStr) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = htmlStr;
  return (tmp.textContent || tmp.innerText || "").trim();
}

/* ==========================================================================
   3. Data Fetching & Multi-Feed Pipeline
   ========================================================================== */
async function fetchNews() {
  renderSkeletons();
  updateSectionHeading();

  let rawArticles = [];
  let providerName = "Free Live Feed";

  try {
    if (state.query) {
      // Keyword search via Google News RSS through rss2json
      providerName = "Google News Live Search";
      rawArticles = await fetchGoogleNewsRssSearch(state.query, state.country);
    } else {
      // Category & region news via Saurav.tech mirror
      providerName = "Live Global Feed";
      try {
        rawArticles = await fetchSauravNews(state.category, state.country);
      } catch (err) {
        console.warn("Primary feed failed, falling back to Google News RSS:", err);
      }

      // If primary returned empty or failed, fallback to Google News RSS
      if (!rawArticles || rawArticles.length === 0) {
        providerName = "Google News Live Feed";
        rawArticles = await fetchGoogleNewsRssCategory(state.category, state.country);
      }
    }

    // Process, deduplicate and analyze sentiment for each article
    const processed = processArticles(rawArticles);
    state.articles = processed;

    // Collect distinct publisher sources for the filter dropdown
    const sourceSet = new Set();
    processed.forEach((a) => {
      if (a.source && a.source !== "Unknown") sourceSet.add(a.source);
    });
    state.sources = Array.from(sourceSet).sort();

    // Update provider status badge
    elements.providerText.textContent = providerName;
    elements.providerBadge.title = `Data source: ${providerName} (CORS-friendly live feed)`;

    populateSourceDropdown(state.sources);
    filterAndRenderArticles();
  } catch (err) {
    console.error("All news feed attempts failed:", err);
    renderError("Unable to connect to live news feeds. Please check your internet connection and try again.");
  }
}

/**
 * Fetch from Saurav.tech NewsAPI Mirror (Exact NewsAPI structure, CORS allowed)
 */
async function fetchSauravNews(category, country) {
  const url = `https://saurav.tech/NewsAPI/top-headlines/category/${encodeURIComponent(category)}/${encodeURIComponent(country)}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Saurav feed returned HTTP ${res.status}`);
  const data = await res.json();

  if (data.status === "ok" && Array.isArray(data.articles)) {
    return data.articles.map((item) => ({
      title: item.title,
      description: item.description || item.content,
      url: item.url,
      image_url: item.urlToImage || "./static/images/placeholder.svg",
      source: item.source && item.source.name ? item.source.name : "News",
      published_at_raw: item.publishedAt,
      category: state.category
    }));
  }
  return [];
}

/**
 * Fetch Google News RSS for Search via rss2json
 */
async function fetchGoogleNewsRssSearch(query, country) {
  const gl = country.toUpperCase();
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-${gl}&gl=${gl}&ceid=${gl}:en`;
  return await fetchViaRss2Json(rssUrl);
}

/**
 * Fetch Google News RSS for Categories via rss2json
 */
async function fetchGoogleNewsRssCategory(category, country) {
  const gl = country.toUpperCase();
  const topic = GOOGLE_NEWS_TOPICS[category];
  let rssUrl = `https://news.google.com/rss?hl=en-${gl}&gl=${gl}&ceid=${gl}:en`;
  if (topic) {
    rssUrl = `https://news.google.com/rss/headlines/section/topic/${topic}?hl=en-${gl}&gl=${gl}&ceid=${gl}:en`;
  }
  return await fetchViaRss2Json(rssUrl);
}

/**
 * Helper to fetch and parse RSS feeds via rss2json.com
 */
async function fetchViaRss2Json(rssUrl) {
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`rss2json returned HTTP ${res.status}`);
  const data = await res.json();

  if (data.status === "ok" && Array.isArray(data.items)) {
    return data.items.map((item) => {
      // Extract publisher source from title (Google News format: "Headline - Source Name")
      let title = item.title || "";
      let sourceName = "Google News";
      const lastDash = title.lastIndexOf(" - ");
      if (lastDash > 0) {
        sourceName = title.substring(lastDash + 3).trim();
        title = title.substring(0, lastDash).trim();
      }

      // Clean HTML from description
      let cleanDesc = stripHtml(item.description || item.content || "");
      if (cleanDesc.length > 250) {
        cleanDesc = cleanDesc.substring(0, 247) + "...";
      }

      const imageUrl = item.thumbnail || (item.enclosure && item.enclosure.link) || "./static/images/placeholder.svg";

      return {
        title,
        description: cleanDesc,
        url: item.link,
        image_url: imageUrl,
        source: sourceName,
        published_at_raw: item.pubDate,
        category: state.category
      };
    });
  }
  return [];
}

/**
 * Post-processes, deduplicates, and adds sentiment analysis to articles
 */
function processArticles(articles) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const result = [];

  for (const a of articles) {
    if (!a.title || a.title.includes("[Removed]")) continue;
    if (!a.url) continue;

    const normUrl = a.url.toLowerCase();
    const normTitle = a.title.toLowerCase().trim();

    if (seenUrls.has(normUrl) || seenTitles.has(normTitle)) continue;
    seenUrls.add(normUrl);
    seenTitles.add(normTitle);

    const pubDate = a.published_at_raw ? new Date(a.published_at_raw) : new Date();
    const sentiment = analyzeSentiment(`${a.title} ${a.description || ""}`);

    result.push({
      ...a,
      published_at: pubDate.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      time_ago: formatRelativeTime(pubDate),
      sentiment
    });
  }

  return result;
}

/* ==========================================================================
   4. Filtering, Sorting & Rendering
   ========================================================================== */
function filterAndRenderArticles() {
  let list = [...state.articles];

  // 1. Source filtering
  if (state.source && state.source !== "all") {
    list = list.filter((a) => (a.source || "").toLowerCase() === state.source.toLowerCase());
  }

  // 2. Client-side sorting
  if (state.sortBy === "oldest") {
    list.sort((a, b) => new Date(a.published_at_raw) - new Date(b.published_at_raw));
  } else if (state.sortBy === "title") {
    list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
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
  attachCardEvents();
}

function createNewsCardHTML(article, index) {
  const isSaved = state.bookmarks.some((b) => b.url === article.url);
  const bookmarkIcon = isSaved ? "★" : "☆";
  const bookmarkClass = isSaved ? "saved" : "";

  // Sentiment formatting
  const sentiment = article.sentiment || { label: "Neutral", badge_class: "badge-neutral" };
  const sentimentIcon = sentiment.label === "Positive" ? "🟢" : sentiment.label === "Negative" ? "🔴" : "⚪";

  const imgUrl = article.image_url || "./static/images/placeholder.svg";

  return `
    <article class="news-card" data-index="${index}">
      <div class="card-media">
        <img 
          class="card-img" 
          src="${escapeHTML(imgUrl)}" 
          alt="${escapeHTML(article.title)}" 
          loading="lazy"
          onerror="this.onerror=null; this.src='./static/images/placeholder.svg';"
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
          <span style="font-size: 0.75rem; color: var(--text-dim);">${escapeHTML(article.source || "")}</span>
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
   5. Loading, Empty & Error UI States
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

window.resetFilters = function () {
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
};

/* ==========================================================================
   6. Bookmarks Management (localStorage)
   ========================================================================== */
function toggleBookmark(article) {
  const existingIdx = state.bookmarks.findIndex((b) => b.url === article.url);

  if (existingIdx > -1) {
    state.bookmarks.splice(existingIdx, 1);
    showToast("Article removed from bookmarks");
  } else {
    state.bookmarks.push({
      title: article.title,
      url: article.url,
      source: article.source,
      image_url: article.image_url,
      published_at: article.published_at,
      time_ago: article.time_ago,
      category: article.category,
      saved_at: new Date().toISOString()
    });
    showToast("Article saved to bookmarks! 🔖");
  }

  localStorage.setItem("news_bookmarks", JSON.stringify(state.bookmarks));
  updateBookmarkCounter();
  filterAndRenderArticles();
}

function updateBookmarkCounter() {
  elements.bookmarkCount.textContent = state.bookmarks.length;
  elements.bookmarkCount.style.display = state.bookmarks.length > 0 ? "inline-flex" : "none";
}

function openBookmarksModal() {
  renderBookmarksList();
  elements.bookmarksModal.classList.add("active");
}

function renderBookmarksList() {
  if (state.bookmarks.length === 0) {
    elements.bookmarksList.innerHTML = `
      <div class="state-container" style="padding: 2rem 1rem;">
        <div class="state-icon" style="font-size: 2.5rem;">🔖</div>
        <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">No Saved Articles</h4>
        <p style="color: var(--text-dim); font-size: 0.85rem;">Bookmark interesting articles to read them later anytime.</p>
      </div>
    `;
    return;
  }

  elements.bookmarksList.innerHTML = state.bookmarks
    .map(
      (b, idx) => `
      <div class="bookmark-item">
        <img 
          src="${escapeHTML(b.image_url || "./static/images/placeholder.svg")}" 
          class="bookmark-thumb" 
          alt="" 
          onerror="this.src='./static/images/placeholder.svg';"
        >
        <div class="bookmark-info">
          <a href="${escapeHTML(b.url)}" target="_blank" rel="noopener noreferrer" class="bookmark-title">
            ${escapeHTML(b.title)}
          </a>
          <div class="bookmark-meta">
            <span>${escapeHTML(b.source || "News")}</span>
            <span>&bull;</span>
            <span>${escapeHTML(b.time_ago || "Saved")}</span>
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
   7. Settings & Key Preferences (localStorage)
   ========================================================================== */
function saveCustomApiKey() {
  if (!elements.customApiKeyInput) return;
  const key = elements.customApiKeyInput.value.trim();
  if (key) {
    state.apiKey = key;
    localStorage.setItem("news_aggregator_custom_key", key);
    showToast("Custom key saved! 🔑");
  } else {
    localStorage.removeItem("news_aggregator_custom_key");
    state.apiKey = "";
    showToast("Switched to Free Live Feed");
  }
  elements.settingsModal.classList.remove("active");
  fetchNews();
}

function resetToFreeMode() {
  localStorage.removeItem("news_aggregator_custom_key");
  state.apiKey = "";
  if (elements.customApiKeyInput) elements.customApiKeyInput.value = "";
  elements.settingsModal.classList.remove("active");
  showToast("Switched to Free Live Feed!");
  fetchNews();
}

/* ==========================================================================
   8. Theme Toggle (Dark / Light)
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
   9. Utility Functions
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
