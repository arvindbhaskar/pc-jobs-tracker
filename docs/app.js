(function () {
  const state = {
    postings: [],
    platform: "all",
    search: "",
    company: "",
    country: "",
    sort: "newest",
  };

  const els = {
    stats: document.getElementById("stats"),
    headerMeta: document.getElementById("headerMeta"),
    list: document.getElementById("list"),
    empty: document.getElementById("empty"),
    search: document.getElementById("search"),
    company: document.getElementById("company"),
    country: document.getElementById("country"),
    sort: document.getElementById("sort"),
    resultCount: document.getElementById("resultCount"),
    tabs: [...document.querySelectorAll(".tab")],
  };

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function foundTime(p) {
    return p.foundAt || p.asOf || "";
  }

  async function load() {
    const res = await fetch("feed.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load feed.json");
    const feed = await res.json();
    const gw = feed.platforms?.guidewire || {};
    const dc = feed.platforms?.duckcreek || {};
    const mj = feed.platforms?.majesco || {};
    const postings = [
      ...(gw.postings || []).map((p) => ({ ...p, platform: "guidewire", platformLabel: "Guidewire" })),
      ...(dc.postings || []).map((p) => ({ ...p, platform: "duckcreek", platformLabel: "Duck Creek" })),
      ...(mj.postings || []).map((p) => ({ ...p, platform: "majesco", platformLabel: "Majesco" })),
    ];
    state.postings = postings;
    state.feed = feed;
    renderMeta(feed);
    renderStats(feed);
    fillFilters(postings);
    render();
  }

  function renderMeta(feed) {
    const gw = feed.platforms.guidewire;
    const dc = feed.platforms.duckcreek;
    const mj = feed.platforms.majesco || {};
    els.headerMeta.innerHTML = `
      <span class="pill muted">Updated ${escapeHtml(feed.generatedAt || gw.asOf || "—")}</span>
      <span class="pill gw">${gw.postingCount ?? 0} Guidewire</span>
      <span class="pill dc">${dc.postingCount ?? 0} Duck Creek</span>
      <span class="pill mj">${mj.postingCount ?? 0} Majesco</span>
    `;
  }

  function renderStats(feed) {
    const gw = feed.platforms.guidewire || {};
    const dc = feed.platforms.duckcreek || {};
    const mj = feed.platforms.majesco || {};
    const gwNew = gw.lastRun?.newCount;
    const dcNew = dc.lastRun?.newCount;
    const mjNew = mj.lastRun?.newCount;
    els.stats.innerHTML = `
      <article class="stat-card">
        <p class="label">Guidewire live</p>
        <p class="value">${gw.postingCount ?? 0}</p>
        <p class="sub">as of ${escapeHtml(gw.asOf || "—")} · new ${gwNew == null ? "—" : gwNew}</p>
      </article>
      <article class="stat-card">
        <p class="label">Duck Creek live</p>
        <p class="value">${dc.postingCount ?? 0}</p>
        <p class="sub">as of ${escapeHtml(dc.asOf || "—")} · new ${dcNew == null ? "—" : dcNew}</p>
      </article>
      <article class="stat-card">
        <p class="label">Majesco live</p>
        <p class="value">${mj.postingCount ?? 0}</p>
        <p class="sub">as of ${escapeHtml(mj.asOf || "—")} · new ${mjNew == null ? "—" : mjNew}</p>
      </article>
      <article class="stat-card">
        <p class="label">Total live</p>
        <p class="value">${(gw.postingCount ?? 0) + (dc.postingCount ?? 0) + (mj.postingCount ?? 0)}</p>
        <p class="sub">top ~50 P&amp;C carriers</p>
      </article>
    `;
  }

  function fillFilters(postings) {
    const companies = [...new Set(postings.map((p) => p.company || p.verifiedEmployer).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const countries = [...new Set(postings.map((p) => p.country).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    els.company.innerHTML = `<option value="">All companies</option>` + companies.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    els.country.innerHTML = `<option value="">All countries</option>` + countries.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  }

  function filtered() {
    const q = state.search.trim().toLowerCase();
    let rows = state.postings.filter((p) => {
      if (state.platform !== "all" && p.platform !== state.platform) return false;
      if (state.company && (p.company || p.verifiedEmployer) !== state.company) return false;
      if (state.country && p.country !== state.country) return false;
      if (!q) return true;
      const hay = [p.title, p.company, p.verifiedEmployer, p.country, p.snippet, p.platformLabel].join(" ").toLowerCase();
      return hay.includes(q);
    });
    rows = [...rows];
    if (state.sort === "company") {
      rows.sort((a, b) => String(a.company || "").localeCompare(String(b.company || "")) || String(a.title || "").localeCompare(String(b.title || "")));
    } else if (state.sort === "title") {
      rows.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    } else {
      rows.sort((a, b) => String(foundTime(b)).localeCompare(String(foundTime(a))));
    }
    return rows;
  }

  function render() {
    const rows = filtered();
    els.resultCount.textContent = `${rows.length} posting${rows.length === 1 ? "" : "s"}`;
    if (!rows.length) {
      els.list.innerHTML = "";
      els.empty.classList.remove("hidden");
      return;
    }
    els.empty.classList.add("hidden");
    els.list.innerHTML = rows.map((p) => {
      const badgeClass = p.platform === "guidewire" ? "gw" : p.platform === "duckcreek" ? "dc" : "mj";
      const company = p.company || p.verifiedEmployer || "Unknown";
      return `
        <article class="card">
          <div class="card-top">
            <h2><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.title)}</a></h2>
            <div class="badges"><span class="badge ${badgeClass}">${escapeHtml(p.platformLabel)}</span></div>
          </div>
          <div class="meta">
            <span>${escapeHtml(company)}</span>
            <span>${escapeHtml(p.country || "—")}</span>
            <span class="mono">Found ${escapeHtml(formatDate(foundTime(p)))}</span>
          </div>
          ${p.snippet ? `<p class="snippet">${escapeHtml(p.snippet)}</p>` : ""}
          <div class="card-actions">
            <a class="btn" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">Open posting →</a>
          </div>
        </article>
      `;
    }).join("");
  }

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.platform = tab.dataset.platform;
      els.tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      render();
    });
  });
  els.search.addEventListener("input", () => { state.search = els.search.value; render(); });
  els.company.addEventListener("change", () => { state.company = els.company.value; render(); });
  els.country.addEventListener("change", () => { state.country = els.country.value; render(); });
  els.sort.addEventListener("change", () => { state.sort = els.sort.value; render(); });

  load().catch((err) => {
    els.headerMeta.innerHTML = `<span class="pill muted">Failed to load data</span>`;
    els.list.innerHTML = "";
    els.empty.textContent = String(err.message || err);
    els.empty.classList.remove("hidden");
  });
})();
