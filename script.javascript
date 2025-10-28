(() => {
  // ---------- Utilidades ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const LS_KEY = "ociohub-plans";
  const THEME_KEY = "ociohub-theme";

  const defaultPlans = [
    {
      id: cryptoRandomId(),
      title: "Maratón Studio Ghibli",
      category: "Cine",
      difficulty: "Media",
      deadline: nextDays(14),
      link: "https://ghibliapi.vercel.app/",
      status: "todo",
      createdAt: Date.now()
    },
    {
      id: cryptoRandomId(),
      title: "Terminar Hollow Knight",
      category: "Videojuegos",
      difficulty: "Difícil",
      deadline: nextDays(21),
      link: "",
      status: "doing",
      createdAt: Date.now()
    },
    {
      id: cryptoRandomId(),
      title: "Leer ‘El nombre del viento’",
      category: "Lectura",
      difficulty: "Media",
      deadline: nextDays(30),
      link: "",
      status: "done",
      createdAt: Date.now()
    }
  ];

  function cryptoRandomId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return "id-" + Math.random().toString(36).slice(2, 10);
  }
  function nextDays(n){
    const d = new Date(); d.setDate(d.getDate()+n);
    return d.toISOString().slice(0,10);
  }
  function loadPlans(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : defaultPlans;
    }catch(e){
      console.warn("No se pudo leer localStorage:", e);
      return defaultPlans;
    }
  }
  function savePlans(plans){
    localStorage.setItem(LS_KEY, JSON.stringify(plans));
    drawStats(plans);
  }

  // ---------- Estado ----------
  let state = {
    plans: loadPlans(),
    filters: {
      search: "",
      category: "Todas",
      difficulty: "Todas"
    }
  };

  // ---------- Inicialización ----------
  document.addEventListener("DOMContentLoaded", () => {
    wireForm();
    wireFilters();
    wireBoardDnD();
    wireTheme();
    wireImportExport();

    renderAll();
    drawStats(state.plans);

    // Restaurar tema
    const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
    if(savedTheme === "light") {
      document.body.classList.add("light");
      const btn = $("#toggle-theme");
      if(btn) btn.setAttribute("aria-pressed", "true");
    }
  });

  // ---------- Render ----------
  function renderAll(){
    const lists = {
      todo: $('.column[data-status="todo"] .dropzone'),
      doing: $('.column[data-status="doing"] .dropzone'),
      done: $('.column[data-status="done"] .dropzone')
    };
    Object.values(lists).forEach(el => el.innerHTML = "");

    let plans = applyFilters(state.plans, state.filters);
    for(const p of plans){
      const card = renderCard(p);
      lists[p.status].appendChild(card);
    }
  }

  function renderCard(plan){
    const card = document.createElement("article");
    card.className = "card";
    card.setAttribute("draggable", "true");
    card.dataset.id = plan.id;

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = plan.title;

    const actions = document.createElement("div");
    actions.className = "actions";

    const btnLeft = document.createElement("button");
    btnLeft.className = "icon-btn"; btnLeft.title = "Mover a la izquierda";
    btnLeft.textContent = "⬅︎";
    btnLeft.addEventListener("click", () => shiftStatus(plan.id, -1));

    const btnRight = document.createElement("button");
    btnRight.className = "icon-btn"; btnRight.title = "Mover a la derecha";
    btnRight.textContent = "➡︎";
    btnRight.addEventListener("click", () => shiftStatus(plan.id, +1));

    const btnDelete = document.createElement("button");
    btnDelete.className = "icon-btn"; btnDelete.title = "Eliminar";
    btnDelete.textContent = "🗑️";
    btnDelete.addEventListener("click", () => removePlan(plan.id));

    actions.append(btnLeft, btnRight, btnDelete);

    const meta = document.createElement("div");
    meta.className = "meta";
    const badgeCat = badge(plan.category, "blue");
    const badgeDif = badge(plan.difficulty, plan.difficulty === "Fácil" ? "green" : plan.difficulty === "Media" ? "" : "orange");
    const badgeDeadline = badge(plan.deadline ? `Límite: ${formatDate(plan.deadline)}` : "Sin fecha");
    meta.append(badgeCat, badgeDif, badgeDeadline);

    card.append(title, actions, meta);

    if (plan.link) {
      const link = document.createElement("a");
      link.href = plan.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Abrir enlace ↗";
      link.setAttribute("aria-label", `Abrir enlace de ${plan.title}`);
      card.appendChild(link);
    }

    // drag events
    card.addEventListener("dragstart", (e) => {
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", plan.id);
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));

    return card;
  }

  function badge(text, colorClass=""){
    const b = document.createElement("span");
    b.className = "badge" + (colorClass ? " " + colorClass : "");
    b.textContent = text;
    return b;
  }

  function applyFilters(plans, {search, category, difficulty}){
    return plans.filter(p => {
      const okSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
      const okCat = category === "Todas" || p.category === category;
      const okDif = difficulty === "Todas" || p.difficulty === difficulty;
      return okSearch && okCat && okDif;
    }).sort((a,b) => {
      // ordenar por estado y fecha límite próxima
      const order = {todo:0, doing:1, done:2};
      const s = order[a.status] - order[b.status];
      if (s !== 0) return s;
      return (a.deadline || "").localeCompare(b.deadline || "");
    });
  }

  function formatDate(iso){
    if(!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, {year:"numeric", month:"short", day:"2-digit"});
  }

  // ---------- Interacciones ----------
  function wireForm(){
    $("#plan-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const title = $("#title").value.trim();
      const category = $("#category").value;
      if(!title || !category){ return; }
      const difficulty = $("#difficulty").value || "Media";
      const deadline = $("#deadline").value || "";
      const link = $("#link").value.trim();

      const newPlan = {
        id: cryptoRandomId(),
        title, category, difficulty, deadline, link,
        status: "todo",
        createdAt: Date.now()
      };
      state.plans.push(newPlan);
      savePlans(state.plans);
      e.target.reset();
      renderAll();
    });

    $("#clear-all").addEventListener("click", () => {
      if(confirm("¿Seguro que quieres vaciar todo el tablero? Esta acción no se puede deshacer.")){
        state.plans = [];
        savePlans(state.plans);
        renderAll();
      }
    });
  }

  function wireFilters(){
    $("#search").addEventListener("input", (e) => {
      state.filters.search = e.target.value;
      renderAll();
    });
    $("#filter-category").addEventListener("change", (e) => {
      state.filters.category = e.target.value;
      renderAll();
    });
    $("#filter-difficulty").addEventListener("change", (e) => {
      state.filters.difficulty = e.target.value;
      renderAll();
    });
  }

  function wireBoardDnD(){
    $$(".dropzone").forEach(zone => {
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        const column = zone.closest(".column");
        const status = column.dataset.status;
        moveToStatus(id, status);
      });
    });
  }

  function shiftStatus(id, dir){
    const order = ["todo", "doing", "done"];
    const plan = state.plans.find(p => p.id === id);
    if(!plan) return;
    let idx = order.indexOf(plan.status);
    idx = Math.min(order.length-1, Math.max(0, idx + dir));
    plan.status = order[idx];
    savePlans(state.plans);
    renderAll();
  }

  function moveToStatus(id, status){
    const plan = state.plans.find(p => p.id === id);
    if(!plan) return;
    plan.status = status;
    savePlans(state.plans);
    renderAll();
  }

  function removePlan(id){
    state.plans = state.plans.filter(p => p.id !== id);
    savePlans(state.plans);
    renderAll();
  }

  // ---------- Tema ----------
  function wireTheme(){
    $("#toggle-theme").addEventListener("click", (e) => {
      document.body.classList.toggle("light");
      const isLight = document.body.classList.contains("light");
      e.currentTarget.setAttribute("aria-pressed", String(isLight));
      localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
    });
  }

  // ---------- Importar / Exportar ----------
  function wireImportExport(){
    $("#export-json").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state.plans, null, 2)], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "ociohub-backup.json"; a.click();
      URL.revokeObjectURL(url);
    });

    $("#import-json").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if(!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if(!Array.isArray(data)) throw new Error("Formato inválido");
        // Validación básica
        const cleaned = data.map(x => ({
          id: x.id || cryptoRandomId(),
          title: String(x.title || "Sin título").slice(0,140),
          category: String(x.category || "DIY"),
          difficulty: ["Fácil","Media","Difícil"].includes(x.difficulty) ? x.difficulty : "Media",
          deadline: x.deadline || "",
          link: String(x.link || ""),
          status: ["todo","doing","done"].includes(x.status) ? x.status : "todo",
          createdAt: Number(x.createdAt || Date.now())
        }));
        state.plans = cleaned;
        savePlans(state.plans);
        renderAll();
        e.target.value = "";
      } catch (err){
        alert("No se pudo importar el archivo: " + err.message);
      }
    });
  }

  // ---------- Gráfico simple (Canvas 2D) ----------
  function drawStats(plans){
    const canvas = $("#stats-canvas");
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;

    // Clear
    ctx.clearRect(0,0,w,h);

    // Datos: conteo por categoría
    const counts = plans.reduce((acc,p)=>{
      acc[p.category] = (acc[p.category]||0) + 1;
      return acc;
    }, {});
    const labels = Object.keys(counts);
    const values = Object.values(counts);

    // Fondo
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--bg-soft") || "#111827";
    ctx.fillRect(0,0,w,h);

    // Ejes
    ctx.strokeStyle = "rgba(148,163,184,.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 20);
    ctx.lineTo(50, h-40);
    ctx.lineTo(w-20, h-40);
    ctx.stroke();

    // Texto
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text") || "#e5e7eb";
    ctx.font = "12px system-ui";

    // Barras
    const max = Math.max(1, ...values);
    const barWidth = Math.max(20, Math.min(80, (w-90) / Math.max(1, labels.length)));
    labels.forEach((lab, i) => {
      const x = 60 + i * (barWidth + 14);
      const barH = ((h-80) * (counts[lab] / max)) | 0;
      const y = (h-40) - barH;

      // barra
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, "#3b82f6");
      grad.addColorStop(1, "#22c55e");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, barH);

      // valor
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text") || "#e5e7eb";
      ctx.textAlign = "center";
      ctx.fillText(String(counts[lab]), x + barWidth/2, y - 6);

      // etiqueta
      ctx.fillStyle = "rgba(148,163,184,.9)";
      wrapText(ctx, lab, x + barWidth/2, h-22, barWidth+6, 12);
    });

    // Título
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(148,163,184,1)";
    ctx.font = "bold 14px system-ui";
    ctx.fillText("Planes por categoría", 14, 16);
  }

  function wrapText(ctx, text, centerX, baseY, maxWidth, lineHeight){
    const words = text.split(" ");
    let line = "", lines = [];
    for(const w of words){
      const test = line ? line + " " + w : w;
      if(ctx.measureText(test).width > maxWidth){
        lines.push(line); line = w;
      } else { line = test; }
    }
    if(line) lines.push(line);
    const offsetY = baseY - (lines.length-1)*lineHeight/2;
    lines.forEach((ln, idx) => {
      ctx.textAlign = "center";
      ctx.fillText(ln, centerX, offsetY + idx*lineHeight);
    });
  }
})();
