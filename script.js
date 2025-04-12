// Regisztráljuk a service workert a PWA működéshez
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(() => console.log('Service Worker regisztrálva!'))
    .catch(err => console.log('Service Worker regisztráció sikertelen:', err));
}

// Alap kategóriák (built-in)
const defaultCategories = [
  { value: "bevétel", label: "💰 Bevétel" },
  { value: "kiadás", label: "🛒 Kiadás" },
  { value: "megtakarítás", label: "🏦 Megtakarítás" }
];

// Egyéni kategóriák: objektumok { name: "Név", icon: "Emoji" }
let customCategories = JSON.parse(localStorage.getItem("customCategories")) || [];

// Tranzakciók tárolása (objektumok: description, amount, category, date)
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

// A kiválasztott dátum szerinti (hónap és év) szűréshez
let currentMonthIndex = new Date().getMonth();
let currentYear = new Date().getFullYear();

function updateDateHeader() {
  const monthNames = ["Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"];
  document.getElementById("currentMonth").textContent = `Aktuális hónap: ${monthNames[currentMonthIndex]} ${currentYear}`;
}

function saveData() {
  localStorage.setItem("customCategories", JSON.stringify(customCategories));
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

/* Egyéni kategória kezelése */
// Új egyéni kategória hozzáadása két input alapján: név és ikon
function addCategory() {
  const newCatName = document.getElementById("newCategory").value.trim();
  const newCatIcon = document.getElementById("newCategoryIcon").value.trim();
  if (!newCatName || !newCatIcon) return;
  
  const existsDefault = defaultCategories.some(cat => cat.value === newCatName.toLowerCase());
  const existsCustom = customCategories.some(cat => cat.name.toLowerCase() === newCatName.toLowerCase());
  if (existsDefault || existsCustom) return;
  
  customCategories.push({ name: newCatName, icon: newCatIcon });
  saveData();
  updateCategoryList();
  document.getElementById("newCategory").value = "";
  document.getElementById("newCategoryIcon").value = "";
}

// Frissíti a <select> elemet a kategóriákkal (default + custom)
function updateCategoryList() {
  const categorySelect = document.getElementById("category");
  categorySelect.innerHTML = "";
  defaultCategories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat.value;
    option.textContent = cat.label;
    categorySelect.appendChild(option);
  });
  customCategories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat.name;
    option.textContent = `${cat.icon} ${cat.name}`;
    categorySelect.appendChild(option);
  });
}

/* Segédfüggvény, hogy egy kategória expense-e */
function isExpense(categoryValue) {
  if (categoryValue === "kiadás") return true;
  return customCategories.some(cat => cat.name === categoryValue);
}

/* Tranzakciók kezelése */
// Új tranzakció hozzáadása: a dátumot a "transactionDate" inputból olvassa (ha nincs, akkor a mai napot használja)
function addTransaction() {
  const description = document.getElementById("description").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);
  const category = document.getElementById("category").value;
  let dateVal = document.getElementById("transactionDate").value;
  if (!description || isNaN(amount)) return;
  if (!dateVal) {
    dateVal = new Date().toISOString().split("T")[0];
  }
  const transaction = { description, amount, category, date: dateVal };
  transactions.push(transaction);
  saveData();
  updateUI();
  document.getElementById("description").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("transactionDate").value = "";
}

// Megtakarításból kivenés: tranzakció a "megtakarítás" kategóriában, negatív összeggel
function withdrawSavings() {
  const amount = parseFloat(document.getElementById("withdrawAmount").value);
  if (isNaN(amount)) return;
  const transaction = { description: "💸 Megtakarítás kivonása", amount: -amount, category: "megtakarítás", date: new Date().toISOString().split("T")[0] };
  transactions.push(transaction);
  saveData();
  updateUI();
  document.getElementById("withdrawAmount").value = "";
}

// Törlés: a megadott indexű tranzakciót eltávolítja
function deleteTransaction(index) {
  transactions.splice(index, 1);
  saveData();
  updateUI();
}

// Frissíti a UI-t: csak az aktuális hónaphoz tartozó tranzakciókat jeleníti meg, és kiszámolja az egyenleget és a megtakarítást
function updateUI() {
  const transactionsList = document.getElementById("transactions");
  transactionsList.innerHTML = "";
  let balanceTotal = 0;
  let savingsTotal = 0;

  // Végigmegyünk az eredeti tranzakciókon az eredeti index megtartása miatt
  transactions.forEach((t, i) => {
    const tDate = new Date(t.date);
    if (tDate.getMonth() === currentMonthIndex && tDate.getFullYear() === currentYear) {
      const li = document.createElement("li");
      let displayAmount = t.amount;
      let categoryDisplay = t.category;
      
      const customCat = customCategories.find(cat => cat.name === t.category);
      if (customCat) {
        categoryDisplay = `${customCat.icon} ${customCat.name}`;
      } else {
        const defCat = defaultCategories.find(cat => cat.value === t.category);
        if (defCat) categoryDisplay = defCat.label;
      }
      
      // Számoljuk az egyenleget:
      if (t.category === "megtakarítás") {
        savingsTotal += t.amount;
      } else if (isExpense(t.category)) {
        displayAmount = -Math.abs(t.amount);
        balanceTotal -= Math.abs(t.amount);
      } else {
        balanceTotal += t.amount;
      }
      
      li.textContent = `${t.description}: ${displayAmount} Ft (${categoryDisplay}) on ${t.date}`;
      
      // Törlés gomb minden tételhez
      const delBtn = document.createElement("button");
      delBtn.textContent = "Törlés";
      delBtn.style.marginLeft = "10px";
      delBtn.onclick = function() { deleteTransaction(i); };
      li.appendChild(delBtn);
      
      transactionsList.appendChild(li);
    }
  });
  
  document.getElementById("balance").textContent = balanceTotal;
  document.getElementById("savings").textContent = savingsTotal;
  updateChart();
}

// Kördiagram rajzolása – most már a százalékos értékek is megjelennek
function updateChart() {
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  canvas.width = Math.min(400, window.innerWidth - 40);
  canvas.height = canvas.width;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Csak az aktuális hónap expense tranzakciói
  const expenseTransactions = transactions.filter(t => {
    const tDate = new Date(t.date);
    return tDate.getMonth() === currentMonthIndex && tDate.getFullYear() === currentYear && isExpense(t.category);
  });
  
  let totals = {};
  expenseTransactions.forEach(t => {
    if (totals[t.category]) {
      totals[t.category] += Math.abs(t.amount);
    } else {
      totals[t.category] = Math.abs(t.amount);
    }
  });
  
  let totalExpense = Object.values(totals).reduce((sum, val) => sum + val, 0);
  if (totalExpense === 0) {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#333";
    ctx.textAlign = "center";
    ctx.fillText("Nincs elég adat a grafikonhoz", canvas.width / 2, canvas.height / 2);
    return;
  }
  
  let startAngle = 0;
  const colors = ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40", "#66FF66", "#FF6666"];
  let colorIndex = 0;
  
  for (let cat in totals) {
    let sliceAngle = (2 * Math.PI * totals[cat]) / totalExpense;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, canvas.height / 2);
    ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2 - 20, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colors[colorIndex % colors.length];
    ctx.fill();
    
    // Százalék kiszámítása
    let percent = ((totals[cat] / totalExpense) * 100).toFixed(1);
    
    // Felirat a szelet közepére: kategória és százalék
    let midAngle = startAngle + sliceAngle / 2;
    let labelX = canvas.width / 2 + (canvas.width / 4) * Math.cos(midAngle);
    let labelY = canvas.height / 2 + (canvas.height / 4) * Math.sin(midAngle);
    ctx.fillStyle = "#000";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${cat} (${percent}%)`, labelX, labelY);
    
    startAngle += sliceAngle;
    colorIndex++;
  }
}

/* Lapozható pénzügyi napló: dátum szerinti szűrés */
function updateDateHeaderAndFilter() {
  updateDateHeader();
  updateUI();
}

function previousMonth() {
  if (currentMonthIndex === 0) {
    currentMonthIndex = 11;
    currentYear--;
  } else {
    currentMonthIndex--;
  }
  updateDateHeaderAndFilter();
}

function nextMonth() {
  if (currentMonthIndex === 11) {
    currentMonthIndex = 0;
    currentYear++;
  } else {
    currentMonthIndex++;
  }
  updateDateHeaderAndFilter();
}

/* Sötét mód váltása */
document.getElementById("toggleMode").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});

/* Inicializáció */
updateCategoryList();
updateDateHeaderAndFilter();
