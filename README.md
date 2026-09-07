# News Aggregator Using API 📰⚡

**Academic Year:** 2026–2027  
**Degree / Class:** BCS-III (B.Sc. Computer Science - Entire)  
**Institution:** Yashwantrao Chavan Mahavidyalaya, Urun-Islampur  
**Student Name:** Anushka Anil Jadhav  

---

## 1. Project Overview

The **News Aggregator Using API** is a full-stack, beginner-friendly web application designed to collect, clean, filter, and display the latest news articles from multiple worldwide sources through a unified, responsive interface.

Instead of browsing dozens of individual news portals, users can access breaking stories, search topics of interest, filter by category or publisher, and read the original articles on their source websites with a single click.

---

## 2. Key Features

- 🌐 **Multi-Source News Ingestion**: Supports **NewsAPI.org** endpoints (`/v2/top-headlines` and `/v2/everything`) as well as an automatic **Free Live Feed Fallback** (requires zero API keys, no quotas!).
- 🏷️ **Category-Wise News**: Instant categorization across **General, Business, Technology, Sports, Entertainment, Health, and Science**.
- 🔍 **Real-Time Keyword Search**: Search across millions of articles by keyword, brand, or topic.
- 🧹 **Data Preprocessing & Cleaning**:
  - Automatically handles missing or broken article images using themed fallback banners.
  - Strips HTML artifacts and truncated text tags (e.g. `[+1200 chars]`).
  - Converts raw ISO/RFC timestamps into friendly relative labels (*"2h ago"*, *"Yesterday"*).
- 🚫 **Duplicate Detection & Removal**: Filters out repeated news stories from multiple syndications by matching normalized title slugs and URLs.
- 🤖 **AI/ML Sentiment Analysis**: Lightweight rule-based sentiment classifier tags each story with a sentiment badge (**Positive 🟢**, **Neutral ⚪**, or **Negative 🔴**).
- 🔖 **Bookmark & Reading List**: Save favorite stories for later offline reading using browser `localStorage`.
- 🌓 **Dark & Light Mode**: Seamless theme switching with saved user preference.
- 📱 **Fully Responsive Layout**: Built with modern CSS Grid and Flexbox for mobile, tablet, and desktop screens.

---

## 3. System Architecture & Flow

```
[External Sources]
  ├── NewsAPI.org API (/v2/top-headlines, /v2/everything)
  └── Free Live Global Feed (Real-time RSS)
          │
          ▼  (HTTP GET via Python requests)
[Flask Backend Server] (app.py & news_service.py)
  ├── 1. Data Collection
  ├── 2. Data Cleaning & HTML Stripping
  ├── 3. Missing Value & Image Handling
  ├── 4. Duplicate Article Removal
  ├── 5. Sentiment Classification
  └── 6. Filtering & Sorting
          │
          ▼  (JSON REST API: /api/news)
[Frontend Client] (templates/index.html & static/)
  ├── Modern Responsive UI (HTML5, CSS3)
  ├── Asynchronous Fetch API (JavaScript ES6)
  ├── Live Search, Category Tabs & Dropdown Filters
  └── Bookmarking System (HTML5 Web Storage)
```

---

## 4. Technologies Used

- **Frontend**:
  - HTML5 (Semantic elements, accessible modals, cards)
  - CSS3 (CSS Variables, CSS Grid, Flexbox, smooth transitions)
  - Vanilla JavaScript ES6 (Async/Await, Fetch API, DOM manipulation, `localStorage`)
- **Backend**:
  - Python 3
  - Flask (REST API microframework)
  - `requests` (HTTP client)
  - `python-dotenv` (Environment configuration)
- **External Data Source**:
  - NewsAPI.org (Primary)
  - Real-Time Live Feed Fallback (Built-in)

---

## 5. Project Directory Structure

```
e:/news_aggregator/
├── app.py                     # Main Flask application & routes
├── config.py                  # Global settings, categories, image mappings
├── requirements.txt           # Python dependencies
├── .env.example               # Template environment configuration
├── .env                       # Active environment configuration
├── README.md                  # Complete project documentation
├── services/
│   └── news_service.py        # Ingestion, preprocessing, deduplication & sentiment
├── templates/
│   └── index.html             # Responsive dashboard template
└── static/
    ├── css/
    │   └── style.css          # CSS styles (Themes, Grid, Cards, Modals)
    ├── js/
    │   └── app.js             # Client-side JavaScript application
    └── images/
        └── placeholder.svg    # Fallback image vector
```

---

## 6. How to Install and Run

### Step 1: Open Terminal / Command Prompt
Navigate to the project directory:
```bash
cd e:\news_aggregator
```

### Step 2: Install Dependencies
Install the required packages using pip:
```bash
pip install -r requirements.txt
```

### Step 3: Configure 3 to 4 NewsAPI.org Keys
Open [`.env`](file:///e:/news_aggregator/.env) in your editor and configure your 4 API keys:
```ini
NEWS_API_KEY_1=a9c24e681bfd482285a81dbf217c0934
NEWS_API_KEY_2=b7f83a152e04419992c431df89ab1052
NEWS_API_KEY_3=c1e459a72b834ef1907722a4b9cd3180
NEWS_API_KEY_4=d8b762f019a34bc681940173eef1284a
```
> **Key Rotation & Quota Failover**: Free tier NewsAPI keys have a 100 requests/day limit. The application implements an **API Key Pool with Round-Robin Rotation & Failover**. When Key #1 reaches its rate limit or fails, the server automatically fails over to Key #2, #3, and #4! You can also view or update all 4 keys via the web interface's Settings modal (**⚙️**).

### Step 4: Run the Application
Start the Flask server:
```bash
python app.py
```

### Step 5: Open in Your Browser
Open your browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 7. REST API Endpoints

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/` | `GET` | Renders the main NewsPulse frontend dashboard. |
| `/api/news` | `GET` | Fetches, preprocesses, deduplicates, and filters articles. Accepts `category`, `q`, `country`, `source`, `sort_by`, `api_key`. |
| `/api/categories`| `GET` | Returns list of supported categories (`general`, `technology`, `business`, etc.). |
| `/api/countries` | `GET` | Returns supported regional country codes. |
| `/api/status` | `GET` | Returns server health and active configuration status. |

---

## 8. BCS-III Project Viva Questions & Answers

**Q1: What is an API and how does this application use it?**  
*Answer:* An API (Application Programming Interface) allows applications to communicate with third-party web servers. This project uses HTTP `GET` requests to query external news endpoints (NewsAPI / live feeds), receives the responses in JSON/XML format, and displays processed articles to the user.

**Q2: How does the application handle missing images and data?**  
*Answer:* In `services/news_service.py`, the `preprocess_article()` function checks if `urlToImage` is valid. If it is null or missing, it dynamically assigns a high-resolution category-relevant image and provides a local SVG fallback if external loading fails.

**Q3: How is duplicate news removed?**  
*Answer:* The `remove_duplicates()` function normalizes article titles by stripping special characters and creating a title slug. It checks each slug and article URL against a memory hash set, eliminating repeated news stories syndicated across multiple outlets.

**Q4: What is the purpose of the Sentiment Analysis component?**  
*Answer:* As outlined in the AI/ML Project Synopsis, the application computes an article sentiment polarity score based on positive and negative tone words in the headline and description, tagging articles as *Positive*, *Neutral*, or *Negative*.

**Q5: How does bookmarking persist without a traditional SQL database?**  
*Answer:* Bookmarks are stored on the client side using the HTML5 `localStorage` API as serialized JSON strings. This keeps the project lightweight, fast, and eliminates the need for complex database setups while retaining user bookmarks across browser sessions.
