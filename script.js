import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = id => document.getElementById(id);
const SAVED_KEY = "edupast-saved-v2";
const THEME_KEY = "edupast-theme-v2";
let papers = [];
let subjects = [];
let savedIds = readJSON(SAVED_KEY, []);
let downloadsThisSession = 0;
let activeAdminTab = "paperAdmin";
let toastTimer;
let currentUser = null;
let adminChecked = false;

function readJSON(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2800);
}
function setMessage(id, message, error = false) {
  const el = $(id);
  el.textContent = message;
  el.classList.toggle("error", error);
}
function subjectExists(name) {
  return subjects.some(s => s.name.toLowerCase() === name.toLowerCase());
}
function paperCard(p) {
  const saved = savedIds.includes(String(p.id));
  return `<article class="paper-card">
    <div class="paper-top"><div class="pdf-icon">PDF</div>
      <span class="level">${escapeHTML(p.level)}</span>
      <button class="bookmark ${saved ? "saved" : ""}" data-bookmark="${escapeHTML(p.id)}" aria-label="${saved ? "Remove bookmark" : "Save paper"}">${saved ? "♥" : "♡"}</button>
    </div>
    <h3>${escapeHTML(p.title)}</h3>
    <p>${escapeHTML(p.description || `${p.level} • ${p.subject}`)}</p>
    <div class="meta"><span>${escapeHTML(p.subject)}</span><span>${p.year}</span><span>${escapeHTML(p.language)}</span></div>
    <div class="card-actions"><button class="btn outline" data-preview="${escapeHTML(p.id)}">▣ Preview</button><button class="btn primary" data-download="${escapeHTML(p.id)}">↓ Download</button></div>
  </article>`;
}
function filteredPapers() {
  const q = $("search").value.trim().toLowerCase();
  const s = $("subjectFilter").value, y = $("yearFilter").value;
  const l = $("levelFilter").value, sort = $("sortFilter").value;
  const list = papers.filter(p => {
    const hay = `${p.title} ${p.subject} ${p.year} ${p.level} ${p.language} ${p.description || ""}`.toLowerCase();
    return (!q || hay.includes(q)) && (!s || p.subject === s) &&
      (!y || String(p.year) === y) && (!l || p.level === l);
  });
  list.sort((a,b) => sort === "oldest" ? a.year-b.year :
    sort === "title" ? a.title.localeCompare(b.title) :
    sort === "downloads" ? (b.downloads||0)-(a.downloads||0) : b.year-a.year);
  return list;
}
function renderPapers() {
  const list = filteredPapers();
  $("paperGrid").innerHTML = list.map(paperCard).join("");
  $("resultsText").textContent = `Showing ${list.length} of ${papers.length} papers`;
  $("emptyState").classList.toggle("hidden", list.length > 0);
  $("paperGrid").classList.toggle("hidden", list.length === 0);
}
function renderBookmarks() {
  const list = papers.filter(p => savedIds.includes(String(p.id)));
  $("bookmarkGrid").innerHTML = list.map(paperCard).join("");
  $("bookmarkGrid").classList.toggle("hidden", !list.length);
  $("bookmarkEmpty").classList.toggle("hidden", !!list.length);
  $("savedCount").textContent = list.length;
}
function renderSubjects() {
  const colors = [["#edf0ff","#5968e9"],["#e7f9f1","#25a777"],["#f2edff","#8964e7"],["#fff2e5","#e79745"],["#fff0f5","#df6794"]];
  $("subjectGrid").innerHTML = subjects.map((s,i) => {
    const count = papers.filter(p => p.subject === s.name).length, c = colors[i % colors.length];
    return `<button class="subject-card" data-subject="${escapeHTML(s.name)}"><span class="subject-icon" style="background:${c[0]};color:${c[1]}">${escapeHTML(s.icon || "▤")}</span><strong>${escapeHTML(s.name)}</strong><span>${count} paper${count===1?"":"s"} →</span></button>`;
  }).join("");
}
function renderFilterOptions(keep = true) {
  const oldSubject = keep ? $("subjectFilter").value : "";
  const oldYear = keep ? $("yearFilter").value : "";
  $("subjectFilter").innerHTML = '<option value="">All subjects</option>' +
    subjects.map(s => `<option value="${escapeHTML(s.name)}">${escapeHTML(s.name)}</option>`).join("");
  $("yearFilter").innerHTML = '<option value="">All years</option>' +
    [...new Set(papers.map(p => p.year))].sort((a,b)=>b-a).map(y => `<option value="${y}">${y}</option>`).join("");
  if (subjects.some(s => s.name === oldSubject)) $("subjectFilter").value = oldSubject;
  if (papers.some(p => String(p.year) === oldYear)) $("yearFilter").value = oldYear;
  $("paperSubject").innerHTML = subjects.map(s => `<option value="${escapeHTML(s.name)}">${escapeHTML(s.name)}</option>`).join("");
}
function renderStats() {
  $("paperCount").textContent = papers.length;
  $("subjectCount").textContent = subjects.length;
  $("downloadCount").textContent = downloadsThisSession;
}
function renderAdminLists() {
  $("adminPaperList").innerHTML = papers.map(p => `<div class="admin-row"><div class="admin-row-info">
    <strong>${escapeHTML(p.title)}</strong><span>${escapeHTML(p.subject)} • ${p.year} • ${escapeHTML(p.level)}${p.is_published ? "" : " • hidden"}</span>
  </div><div class="row-actions"><button class="mini-btn" data-edit-paper="${escapeHTML(p.id)}">Edit</button><button class="mini-btn danger" data-delete-paper="${escapeHTML(p.id)}">Delete</button></div></div>`).join("") ||
    '<p class="hint">No papers added yet.</p>';
  $("adminSubjectList").innerHTML = subjects.map(s => `<div class="admin-row"><div class="admin-row-info">
    <strong>${escapeHTML(s.icon || "▤")} ${escapeHTML(s.name)}</strong><span>${papers.filter(p => p.subject === s.name).length} linked paper(s)</span>
  </div><div class="row-actions"><button class="mini-btn danger" data-delete-subject="${escapeHTML(s.name)}">Delete</button></div></div>`).join("");
}
function renderAll() {
  renderFilterOptions();
  renderPapers();
  renderBookmarks();
  renderSubjects();
  renderStats();
  renderAdminLists();
}
async function loadData() {
  $("resultsText").textContent = "Loading papers...";
  const [{data: subjectData, error: subjectError}, {data: paperData, error: paperError}] = await Promise.all([
    supabase.from("subjects").select("id,name,icon,created_at").order("name"),
    supabase.from("papers").select("id,title,subject_id,year,level,language,description,file_path,downloads,is_published,created_at,subjects(name)").eq("is_published", true).order("year", {ascending:false})
  ]);
  if (subjectError) throw subjectError;
  if (paperError) throw paperError;
  subjects = subjectData || [];
  papers = (paperData || []).map(p => ({...p, subject: p.subjects?.name || "Unknown"}));
  renderAll();
}
function toggleBookmark(id) {
  id = String(id);
  savedIds = savedIds.includes(id) ? savedIds.filter(x=>x!==id) : [...savedIds,id];
  writeJSON(SAVED_KEY, savedIds);
  renderPapers(); renderBookmarks(); renderStats();
  showToast(savedIds.includes(id) ? "Paper saved." : "Removed from saved papers.");
}
function publicPdfUrl(path) {
  if (!path) return "";
  return supabase.storage.from("past-papers").getPublicUrl(path).data.publicUrl;
}
function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g,"-").replace(/^-|-$/g,"");
}
async function openPreview(id) {
  const p = papers.find(x => String(x.id) === String(id));
  if (!p) return;
  $("previewTitle").textContent = p.title;
  $("previewContent").innerHTML = "Loading PDF…";
  $("previewDownload").classList.add("hidden");
  $("pdfModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  const url = publicPdfUrl(p.file_path);
  if (!url) {
    $("previewContent").textContent = "PDF file is not available.";
    return;
  }
  $("previewContent").innerHTML = `<iframe title="${escapeHTML(p.title)} PDF preview" src="${url}#toolbar=1"></iframe>`;
  $("previewDownload").classList.remove("hidden");
  $("previewDownload").href = url;
  $("previewDownload").download = `${safeFileName(p.title)}.pdf`;
  $("previewDownload").onclick = () => countDownload(p.id);
}
function closePreview() {
  $("pdfModal").classList.add("hidden");
  $("previewContent").innerHTML = "";
  document.body.style.overflow = "";
}
async function countDownload(id) {
  downloadsThisSession++;
  renderStats();
  const {error} = await supabase.rpc("increment_paper_downloads", {paper_id: Number(id)});
  if (!error) {
    const p = papers.find(x => Number(x.id) === Number(id));
    if (p) p.downloads = (p.downloads || 0) + 1;
    renderPapers();
  }
}
async function downloadPaper(id) {
  const p = papers.find(x => String(x.id) === String(id));
  if (!p) return;
  const url = publicPdfUrl(p.file_path);
  if (!url) { showToast("PDF missing. Please ask the admin to upload it."); return; }
  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  a.download = `${safeFileName(p.title)}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  await countDownload(id);
}
function clearFilters() {
  $("search").value=""; $("subjectFilter").value=""; $("yearFilter").value="";
  $("levelFilter").value=""; $("sortFilter").value="newest"; renderPapers();
}
function setTheme(dark) {
  document.body.classList.toggle("dark", dark);
  $("themeToggle").textContent = dark ? "☀ Light mode" : "☾ Dark mode";
  try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch {}
}
function showAdmin() {
  $("adminModal").classList.remove("hidden"); document.body.style.overflow="hidden";
  $("adminEmail").focus();
}
function closeAdmin() {
  $("adminModal").classList.add("hidden"); document.body.style.overflow="";
}
async function loginAdmin() {
  setMessage("loginError", "Signing in...");
  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;
  if (!email || !password) { setMessage("loginError","Enter your admin email and password.",true); return; }
  const {data, error} = await supabase.auth.signInWithPassword({email,password});
  if (error) { setMessage("loginError", error.message, true); return; }
  const {data:isAdmin, error:adminError} = await supabase.rpc("is_admin");
  if (adminError || !isAdmin) {
    await supabase.auth.signOut();
    setMessage("loginError","This account is not registered as an EduPastPapers admin.",true);
    return;
  }
  currentUser = data.user;
  adminChecked = true;
  setMessage("loginError","");
  $("adminLogin").classList.add("hidden");
  $("adminDashboard").classList.remove("hidden");
  $("adminEmail").value = ""; $("adminPassword").value = "";
  renderAdminLists();
}
async function logoutAdmin() {
  await supabase.auth.signOut();
  currentUser = null; adminChecked = false;
  $("adminDashboard").classList.add("hidden");
  $("adminLogin").classList.remove("hidden");
}
function switchTab(id) {
  activeAdminTab=id;
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===id));
  document.querySelectorAll(".admin-pane").forEach(p=>p.classList.toggle("hidden",p.id!==id));
}
function resetPaperForm() {
  $("paperForm").reset(); $("editPaperId").value="";
  $("paperYear").value=new Date().getFullYear();
  $("paperFormTitle").textContent="Add a new past paper";
  $("savePaperBtn").textContent="Add paper";
  $("cancelEdit").classList.add("hidden");
  $("paperFormMessage").textContent="";
  renderFilterOptions();
}
function editPaper(id) {
  const p=papers.find(x=>String(x.id)===String(id)); if(!p) return;
  switchTab("paperAdmin"); $("editPaperId").value=p.id; $("paperTitle").value=p.title;
  $("paperSubject").value=p.subject; $("paperYear").value=p.year; $("paperLevel").value=p.level;
  $("paperLanguage").value=p.language; $("paperDescription").value=p.description||"";
  $("paperFile").value=""; $("paperFormTitle").textContent="Edit past paper";
  $("savePaperBtn").textContent="Save changes"; $("cancelEdit").classList.remove("hidden");
  $("paperForm").scrollIntoView({behavior:"smooth",block:"start"});
}
async function savePaper(event) {
  event.preventDefault();
  if (!currentUser || !adminChecked) { setMessage("paperFormMessage","Please sign in as admin first.",true); return; }
  const id=$("editPaperId").value;
  const existing=papers.find(p=>String(p.id)===String(id));
  const title=$("paperTitle").value.trim(), subject=$("paperSubject").value;
  const year=Number($("paperYear").value), level=$("paperLevel").value;
  const language=$("paperLanguage").value, description=$("paperDescription").value.trim();
  const file=$("paperFile").files[0];
  if (!title || !subject || !year) { setMessage("paperFormMessage","Please fill all required fields.",true); return; }
  if (file && (file.type!=="application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
    setMessage("paperFormMessage","Please choose a PDF file.",true); return;
  }
  if (file && file.size > 20 * 1024 * 1024) {
    setMessage("paperFormMessage","PDF must be 20 MB or smaller.",true); return;
  }
  setMessage("paperFormMessage","Saving...");
  let filePath=existing?.file_path || "";
  if (file) {
    filePath=`papers/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const {error:uploadError}=await supabase.storage.from("past-papers").upload(filePath,file,{contentType:"application/pdf",upsert:false});
    if (uploadError) { setMessage("paperFormMessage",`Upload failed: ${uploadError.message}`,true); return; }
    if (existing?.file_path) await supabase.storage.from("past-papers").remove([existing.file_path]);
  } else if (!existing) {
    setMessage("paperFormMessage","Choose a PDF file when adding a new paper.",true); return;
  }
  const payload={title,subject_id:Number(subject),year,level,language,description:description||`${level} • ${subjects.find(s=>String(s.id)===subject)?.name || subject}`,file_path:filePath,is_published:true};
  let result;
  if (existing) {
    result=await supabase.from("papers").update(payload).eq("id",Number(existing.id));
  } else {
    result=await supabase.from("papers").insert(payload);
  }
  if (result.error) {
    if (file && filePath) await supabase.storage.from("past-papers").remove([filePath]);
    setMessage("paperFormMessage",`Could not save paper: ${result.error.message}`,true); return;
  }
  setMessage("paperFormMessage","Saved successfully.");
  showToast(existing ? "Paper updated successfully." : "New past paper added.");
  resetPaperForm();
  await loadData();
}
async function deletePaper(id) {
  const p=papers.find(x=>String(x.id)===String(id)); if(!p) return;
  if(!confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
  const {error}=await supabase.from("papers").delete().eq("id",Number(id));
  if(error){showToast(`Delete failed: ${error.message}`);return;}
  if(p.file_path) await supabase.storage.from("past-papers").remove([p.file_path]);
  savedIds=savedIds.filter(x=>String(x)!==String(id)); writeJSON(SAVED_KEY,savedIds);
  await loadData(); showToast("Paper deleted.");
}
async function addSubject(event) {
  event.preventDefault();
  const name=$("newSubjectName").value.trim(), icon=$("newSubjectIcon").value.trim()||"▤";
  if(!name) return;
  if(subjectExists(name)){setMessage("subjectMessage","That subject already exists.",true);return;}
  const {error}=await supabase.from("subjects").insert({name,icon});
  if(error){setMessage("subjectMessage",`Could not add subject: ${error.message}`,true);return;}
  $("subjectForm").reset(); setMessage("subjectMessage","Subject added successfully.");
  await loadData(); showToast("Subject added.");
}
async function deleteSubject(id) {
  const s=subjects.find(x=>String(x.id)===String(id)); if(!s)return;
  const linked=papers.filter(p=>p.subject===s.name).length;
  if(linked){showToast(`Cannot delete: ${linked} paper(s) use this subject first.`);return;}
  if(!confirm(`Delete subject “${s.name}”?`))return;
  const {error}=await supabase.from("subjects").delete().eq("id",Number(id));
  if(error){showToast(`Delete failed: ${error.message}`);return;}
  await loadData(); showToast("Subject deleted.");
}
function exportBackup() {
  const data={version:2,exportedAt:new Date().toISOString(),papers,subjects};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="edupast-papers-backup.json";a.click();URL.revokeObjectURL(url);
  showToast("Metadata backup exported. PDF files are stored in Supabase Storage.");
}
async function setupEvents() {
  ["search","subjectFilter","yearFilter","levelFilter","sortFilter"].forEach(id=>$(`${id}`).addEventListener(id==="search"?"input":"change",renderPapers));
  $("clearFilters").addEventListener("click",clearFilters); $("emptyClear").addEventListener("click",clearFilters);
  function cardClick(e){
    const b=e.target.closest("[data-bookmark]"),p=e.target.closest("[data-preview]"),d=e.target.closest("[data-download]");
    if(b){toggleBookmark(b.dataset.bookmark);return;} if(p){openPreview(p.dataset.preview);return;} if(d){downloadPaper(d.dataset.download);}
  }
  $("paperGrid").addEventListener("click",cardClick); $("bookmarkGrid").addEventListener("click",cardClick);
  $("subjectGrid").addEventListener("click",e=>{const b=e.target.closest("[data-subject]");if(!b)return;$("subjectFilter").value=b.dataset.subject;renderPapers();$("papers").scrollIntoView({behavior:"smooth"});});
  $("themeToggle").addEventListener("click",()=>setTheme(!document.body.classList.contains("dark")));
  $("menuToggle").addEventListener("click",()=>$("nav").classList.toggle("open"));
  $("nav").addEventListener("click",e=>{if(e.target.closest("a"))$("nav").classList.remove("open")});
  $("adminOpen").addEventListener("click",showAdmin);
  document.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",closePreview));
  document.querySelectorAll("[data-admin-close]").forEach(el=>el.addEventListener("click",closeAdmin));
  $("adminLoginBtn").addEventListener("click",loginAdmin);
  $("adminPassword").addEventListener("keydown",e=>{if(e.key==="Enter")loginAdmin()});
  $("adminLogout").addEventListener("click",logoutAdmin);
  document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("paperForm").addEventListener("submit",savePaper); $("cancelEdit").addEventListener("click",resetPaperForm);
  $("subjectForm").addEventListener("submit",addSubject);
  $("adminPaperList").addEventListener("click",e=>{const edit=e.target.closest("[data-edit-paper]"),del=e.target.closest("[data-delete-paper]");if(edit)editPaper(edit.dataset.editPaper);if(del)deletePaper(del.dataset.deletePaper);});
  $("adminSubjectList").addEventListener("click",e=>{const del=e.target.closest("[data-delete-subject]");if(del)deleteSubject(del.dataset.deleteSubject);});
  $("exportData").addEventListener("click",exportBackup);
  $("importData").addEventListener("change",()=>{$("importData").value="";showToast("Import is not available in the Supabase version. Use the database as the source of truth.");});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closePreview();closeAdmin();}});
  window.addEventListener("scroll",()=>$("backToTop").classList.toggle("visible",window.scrollY>450));
  $("backToTop").addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
}
async function init() {
  $("yearNow").textContent=new Date().getFullYear();
  try{setTheme(localStorage.getItem(THEME_KEY)==="dark");}catch{setTheme(false);}
  setupEvents();
  try{await loadData();}catch(error){
    console.error(error);
    $("resultsText").textContent="Could not load the paper library.";
    showToast("Supabase is not configured yet. Add your Project URL and Publishable Key to config.js.");
  }
  const {data:{session}}=await supabase.auth.getSession();
  if(session){
    const {data:isAdmin}=await supabase.rpc("is_admin");
    if(isAdmin){currentUser=session.user;adminChecked=true;}
  }
}
document.addEventListener("DOMContentLoaded",init);
