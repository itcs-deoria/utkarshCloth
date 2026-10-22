// Saara frontend JS yahan hai (CSP ki wajah se pages me inline JS allowed nahi hai)
const $ = id => document.getElementById(id);

// data-confirm="..." wale form ya button par: pehle puchho, "Cancel" par submit roko
document.addEventListener('submit', e => {
  const message = (e.submitter && e.submitter.dataset.confirm) || e.target.dataset.confirm;
  if (message && !confirm(message)) e.preventDefault();
});

// Order form: item row jodo / hatao
if ($('addrow')) {
  $('addrow').onclick = () => {
    const row = $('rows').firstElementChild.cloneNode(true);
    row.querySelectorAll('input').forEach(i => { i.value = ''; }); // pichli row ki value copy na ho
    row.querySelector('select').selectedIndex = 0;
    $('rows').append(row);
  };
  $('rows').addEventListener('click', e => {
    if (!e.target.classList.contains('rmrow')) return;
    const rows = $('rows');
    if (rows.children.length > 1) e.target.closest('.row').remove(); // kam se kam ek row rahegi
    else rows.querySelectorAll('input').forEach(i => { i.value = ''; });
  });
}

if ($('printbtn')) $('printbtn').onclick = () => window.print();

// Product form (add + edit): Rack -> Shelf -> Column dependent dropdown
const rackData = $('rackdata') ? JSON.parse($('rackdata').textContent) : [];
document.querySelectorAll('.loc-form').forEach(form => {
  const rk = form.querySelector('.rk'), sh = form.querySelector('.sh'), cl = form.querySelector('.cl');
  // Dropdown bharo; "chosen" wali value pehle se select rakho (edit form me product ki purani location)
  const fill = (select, list, chosen) => {
    select.replaceChildren(new Option('-- ' + (select === sh ? 'Shelf' : 'Column') + ' --', ''), ...list.map(x => new Option(x.name, x._id)));
    select.value = chosen || '';
  };
  const update = (shelfId, colId) => {
    const rack = rackData.find(r => r._id === rk.value);
    fill(sh, rack ? rack.shelves : [], shelfId);
    const shelf = rack && rack.shelves.find(s => s._id === sh.value);
    fill(cl, shelf ? shelf.columns : [], colId);
  };
  rk.onchange = () => update();
  sh.onchange = () => update(sh.value);
  update(form.dataset.shelf, form.dataset.col);
});

// App install (PWA): service worker + "Install karo" button (Android/Chrome). iPhone par sirf tip dikhta hai
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
if ($('install')) {
  const box = $('install'), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let ev;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); ev = e; if (!standalone) box.hidden = false; });
  window.addEventListener('appinstalled', () => { box.hidden = true; });
  $('installbtn').onclick = async () => { if (!ev) return; ev.prompt(); await ev.userChoice; ev = null; box.hidden = true; };
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) { box.hidden = false; $('installbtn').hidden = true; $('iostip').hidden = false; }
}
