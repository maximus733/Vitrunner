import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, where, orderBy, limit, onSnapshot,
  runTransaction, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

// ==========================================
// 1. CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBlxQhQ_6l6K5wmxxUzqzuESQRJjekNtww",
  authDomain: "campuscart-vitc.firebaseapp.com",
  projectId: "campuscart-vitc",
  storageBucket: "campuscart-vitc.firebasestorage.app",
  messagingSenderId: "385353746385",
  appId: "1:385353746385:web:1c75a67b96cd19576c02f0",
  measurementId: "G-4VLNJSZJ8P"
};

const ADMIN_EMAIL = "piyush.tripathy2026@vitstudent.ac.in";
const ADMIN_UPI_ID = "massamune78@oksbi";
const MIN_CART_INR = 50;
const MAX_CART_INR = 400;

// Distance-based runner payout (₹5 to ₹15) & hostel gender zoning from V-Mart
const HOSTEL_CONFIG = {
  "A-Block": { gender: "MALE", gate: "A-Block Gate", fee: 5, distanceLabel: "Nearest to V-Mart" },
  "D-Block": { gender: "MALE", gate: "D-Block Gate", fee: 9, distanceLabel: "Medium Walk" },
  "E-Block": { gender: "MALE", gate: "E-Block Gate", fee: 12, distanceLabel: "Far Walk" },
  "F-Block": { gender: "MALE", gate: "F-Block Gate", fee: 15, distanceLabel: "Farthest Block" },
  "B-Block": { gender: "FEMALE", gate: "B-Block Gate", fee: 5, distanceLabel: "Nearest to V-Mart" },
  "C-Block": { gender: "FEMALE", gate: "C-Block Gate", fee: 8, distanceLabel: "Medium Walk" }
};

function getFeeByGate(gateName) {
  const entry = Object.values(HOSTEL_CONFIG).find((h) => h.gate === gateName);
  return entry || { fee: 8, distanceLabel: "Standard Walk", gender: "MALE" };
}

function resolveUserGender(profile) {
  if (profile.gender === "MALE" || profile.gender === "FEMALE") return profile.gender;
  const block = (profile.defaultBlock || "").toUpperCase();
  if (block.startsWith("B") || block.startsWith("C") || block.startsWith("LH")) return "FEMALE";
  return "MALE";
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// State
let currentUser = null;
let userProfile = null;
let cart = [];
let selectedPack = { packId: "mini_20", price: 20, credits: 20 };
let unsubOpenOrders = null;
let unsubMyBuyerOrders = null;
let unsubMyRunnerOrders = null;
let unsubCatalog = null;

// ==========================================
// 2. UTILITIES, PRODUCT ICONS & PWA INSTALL
// ==========================================
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3500);
}

function getProductVisual(item) {
  if (item.imageUrl) {
    return `<img src="${item.imageUrl}" alt="${item.name}" loading="lazy" />`;
  }
  const n = item.name.toLowerCase();
  if (n.includes("maggi") || n.includes("noodle")) {
    return `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#e11d5a" stroke-width="1.6"><path d="M3 11h18v2a8 8 0 0 1-16 0v-2Z"/><path d="M6 11V5m4 6V4m4 7V5m4 6V6" stroke="#38bdf8"/></svg>`;
  }
  if (n.includes("lay") || n.includes("chip") || n.includes("kurkure") || n.includes("snack")) {
    return `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="12" r="3.5" stroke="#e11d5a"/></svg>`;
  }
  if (n.includes("cola") || n.includes("sprite") || n.includes("drink") || n.includes("juice") || n.includes("bull")) {
    return `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.6"><path d="M9 3h6l1 4v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7l1-4Z"/><path d="M8 11h8" stroke="#e11d5a"/></svg>`;
  }
  if (n.includes("pen") || n.includes("book") || n.includes("note") || n.includes("file")) {
    return `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#e11d5a" stroke-width="1.6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="#38bdf8"/></svg>`;
  }
  if (n.includes("oreo") || n.includes("biscuit") || n.includes("cookie") || n.includes("choco")) {
    return `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#e11d5a" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><circle cx="9" cy="10" r="1" fill="#38bdf8"/><circle cx="14" cy="14" r="1" fill="#38bdf8"/><circle cx="14" cy="9" r="1" fill="#38bdf8"/></svg>`;
  }
  return `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.6"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6" stroke="#e11d5a"/><path d="M16 10a4 4 0 0 1-8 0" stroke="#e11d5a"/></svg>`;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(console.error);
}
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById("installBtn").classList.remove("hidden");
});
document.getElementById("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById("installBtn").classList.add("hidden");
});

function compressReceiptImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxWidth = 650;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.65));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==========================================
// 3. AUTHENTICATION (@vitstudent.ac.in ONLY)
// ==========================================
document.getElementById("googleLoginBtn").addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: "vitstudent.ac.in" });
  try {
    const res = await signInWithPopup(auth, provider);
    if (!res.user.email.endsWith("@vitstudent.ac.in")) {
      await signOut(auth);
      showToast("Access restricted to @vitstudent.ac.in accounts.");
    }
  } catch (err) {
    showToast("Sign-in error: " + err.message);
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user || !user.email.endsWith("@vitstudent.ac.in")) {
    currentUser = null;
    document.getElementById("authView").classList.remove("hidden");
    document.getElementById("onboardingView").classList.add("hidden");
    document.getElementById("appShell").classList.add("hidden");
    document.getElementById("logoutBtn").classList.add("hidden");
    return;
  }

  currentUser = user;
  document.getElementById("authView").classList.add("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");

  onSnapshot(doc(db, "users", user.uid), (snap) => {
    if (!snap.exists()) {
      document.getElementById("onboardingView").classList.remove("hidden");
      document.getElementById("appShell").classList.add("hidden");
      document.getElementById("obName").value = user.displayName || "";
    } else {
      const data = snap.data();
      const gender = resolveUserGender(data);
      userProfile = { uid: user.uid, ...data, gender };

      if (!data.gender) {
        updateDoc(doc(db, "users", user.uid), { gender }).catch(() => {});
      }

      if (userProfile.isBanned) {
        alert("Account suspended due to repeated order cancellations.");
        signOut(auth);
        return;
      }
      document.getElementById("onboardingView").classList.add("hidden");
      document.getElementById("appShell").classList.remove("hidden");
      initAppShell();
    }
  });
});

document.getElementById("onboardingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const block = document.getElementById("obBlock").value;
  const gender = HOSTEL_CONFIG[block]?.gender || "MALE";

  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      name: document.getElementById("obName").value.trim(),
      email: currentUser.email,
      defaultBlock: block,
      gender,
      phone: document.getElementById("obPhone").value.trim(),
      upiId: document.getElementById("obUpi").value.trim(),
      runnerCredits: 0,
      strikes: 0,
      isBanned: false,
      createdAt: serverTimestamp()
    });
    showToast("Profile saved.");
  } catch (err) {
    showToast("Error saving profile: " + err.message);
  }
});

// ==========================================
// 4. INITIALIZE APP SHELL & SAME-GENDER GATES
// ==========================================
let shellInitialized = false;
function initAppShell() {
  const isMale = userProfile.gender === "MALE";
  document.getElementById("userDisplayName").textContent = userProfile.name;
  document.getElementById("userBlockBadge").textContent = userProfile.defaultBlock;
  document.getElementById("userZoneBadge").textContent = isMale ? "BOYS ZONE" : "LADIES ZONE";
  document.getElementById("runnerZoneTitle").textContent = isMale ? "Boys A/D/E/F" : "Ladies B/C";
  document.getElementById("headerCreditBadge").textContent = userProfile.runnerCredits;
  document.getElementById("walletBalanceBig").textContent = `${userProfile.runnerCredits} Credits`;
  document.getElementById("adminUpiText").textContent = ADMIN_UPI_ID;
  updateUpiDeepLink();

  if (currentUser.email === ADMIN_EMAIL) {
    document.getElementById("adminNavBtn").classList.remove("hidden");
  }

  if (shellInitialized) return;
  shellInitialized = true;

  const allowedBlocks = Object.entries(HOSTEL_CONFIG).filter(([, cfg]) => cfg.gender === userProfile.gender);
  const dropSelect = document.getElementById("orderDropBlock");
  const filterSelect = document.getElementById("runnerFilterBlock");

  dropSelect.innerHTML = "";
  filterSelect.innerHTML = `<option value="ALL">All ${isMale ? "Boys" : "Ladies"} Gates</option>`;

  allowedBlocks.forEach(([, cfg]) => {
    const opt1 = document.createElement("option");
    opt1.value = cfg.gate;
    opt1.textContent = `${cfg.gate} (${cfg.distanceLabel} | ₹${cfg.fee})`;
    dropSelect.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = cfg.gate;
    opt2.textContent = `${cfg.gate} (₹${cfg.fee})`;
    filterSelect.appendChild(opt2);
  });

  const normalizedBlock = userProfile.defaultBlock.replace(/[0-9]/g, "");
  const userGate = HOSTEL_CONFIG[normalizedBlock]?.gate;
  if (userGate && [...dropSelect.options].some((o) => o.value === userGate)) {
    dropSelect.value = userGate;
  }

  dropSelect.addEventListener("change", renderCart);
  renderCart();

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.target).classList.remove("hidden");
    });
  });

  subscribeCatalog();
  subscribeOpenOrders("ALL");
  subscribeMyActiveOrders();
  subscribeMyTopups();
  if (currentUser.email === ADMIN_EMAIL) initAdminListeners();
}

// ==========================================
// 5. VISUAL CATALOG & BUYER BASKET
// ==========================================
const DEFAULT_CATALOG = [
  { id: "maggi", name: "Maggi Masala Noodles (70g)", approxPrice: 15, inStock: true },
  { id: "lays", name: "Lay's Classic / Magic Masala", approxPrice: 20, inStock: true },
  { id: "coke", name: "Coca-Cola / Sprite (750ml)", approxPrice: 40, inStock: true },
  { id: "oreo", name: "Oreo Chocolate Biscuit Pack", approxPrice: 30, inStock: true },
  { id: "pen", name: "Blue / Black Gel Pen", approxPrice: 10, inStock: true },
  { id: "notebook", name: "Classmate A4 Notebook", approxPrice: 55, inStock: true }
];

function subscribeCatalog() {
  const q = query(collection(db, "catalog"), limit(60));
  unsubCatalog = onSnapshot(q, (snap) => {
    const items = snap.empty ? DEFAULT_CATALOG : snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const grid = document.getElementById("catalogGrid");
    grid.innerHTML = "";
    items.filter((i) => i.inStock !== false).forEach((item) => {
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div>
          <div class="product-thumb">${getProductVisual(item)}</div>
          <div class="product-title">${item.name}</div>
        </div>
        <div class="product-footer">
          <span class="mrp-tag mono">₹${item.approxPrice}</span>
          <span class="add-chip">+ ADD</span>
        </div>
      `;
      card.onclick = () => {
        addToCart(item.name, Number(item.approxPrice));
        showToast(`Added ${item.name}`);
      };
      grid.appendChild(card);
    });
  });
}

function addToCart(name, approxPrice) {
  const existing = cart.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) existing.qty += 1;
  else cart.push({ name, approxPrice, qty: 1 });
  renderCart();
}

document.getElementById("addCustomItemBtn").addEventListener("click", () => {
  const name = document.getElementById("customItemName").value.trim();
  const price = Number(document.getElementById("customItemPrice").value);
  if (!name || price < 5) return showToast("Enter item name and estimated MRP.");
  addToCart(name, price);
  document.getElementById("customItemName").value = "";
  document.getElementById("customItemPrice").value = "";
});

function renderCart() {
  const list = document.getElementById("cartList");
  const selectedGate = document.getElementById("orderDropBlock").value;
  const routeInfo = getFeeByGate(selectedGate);
  const deliveryFee = routeInfo.fee;

  document.getElementById("distanceTierNote").textContent =
    `Distance: ${routeInfo.distanceLabel} | Fixed Runner Fee: ₹${deliveryFee}`;

  let itemsTotal = 0;
  let totalCount = 0;

  if (cart.length === 0) {
    list.innerHTML = `<span class="muted small">Your basket is empty.</span>`;
  } else {
    list.innerHTML = "";
    cart.forEach((item, idx) => {
      itemsTotal += item.approxPrice * item.qty;
      totalCount += item.qty;
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <span>${item.name} <small class="mono text-cerulean">(₹${item.approxPrice})</small></span>
        <div class="qty-controls">
          <button class="qty-btn" data-act="dec" data-idx="${idx}">-</button>
          <strong class="mono">${item.qty}</strong>
          <button class="qty-btn" data-act="inc" data-idx="${idx}">+</button>
        </div>
      `;
      list.appendChild(row);
    });
    list.querySelectorAll(".qty-btn").forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.idx);
        if (b.dataset.act === "inc") cart[i].qty++;
        else {
          cart[i].qty--;
          if (cart[i].qty <= 0) cart.splice(i, 1);
        }
        renderCart();
      };
    });
  }

  document.getElementById("basketCountBadge").textContent = `${totalCount} ${totalCount === 1 ? "ITEM" : "ITEMS"}`;
  document.getElementById("estItemsTotal").textContent = `₹${itemsTotal}`;
  document.getElementById("tipDisplay").textContent = `₹${deliveryFee}`;
  document.getElementById("estGrandTotal").textContent = `₹${itemsTotal + deliveryFee}`;
}

document.getElementById("placeOrderBtn").addEventListener("click", async () => {
  const estTotal = cart.reduce((sum, i) => sum + i.approxPrice * i.qty, 0);
  if (estTotal < MIN_CART_INR) return showToast(`Minimum basket value is ₹${MIN_CART_INR}.`);
  if (estTotal > MAX_CART_INR) return showToast(`Maximum basket value is ₹${MAX_CART_INR}.`);

  const dropBlock = document.getElementById("orderDropBlock").value;
  const routeInfo = getFeeByGate(dropBlock);
  if (routeInfo.gender !== userProfile.gender) {
    return showToast("Orders are restricted to your own hostel zone.");
  }

  const otp = String(Math.floor(1000 + Math.random() * 9000));
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 30 * 60 * 1000);

  try {
    await addDoc(collection(db, "orders"), {
      buyerId: currentUser.uid,
      buyerName: userProfile.name,
      buyerPhone: userProfile.phone,
      targetGender: userProfile.gender,
      dropBlock,
      distanceLabel: routeInfo.distanceLabel,
      items: cart,
      estItemsTotal: estTotal,
      tipAmount: routeInfo.fee,
      status: "OPEN",
      runnerId: null,
      runnerName: null,
      runnerPhone: null,
      runnerUpi: null,
      actualBillAmount: null,
      receiptBase64: null,
      handoffOtp: otp,
      createdAt: serverTimestamp(),
      expiresAt
    });
    cart = [];
    renderCart();
    showToast("Order posted.");
    document.querySelector('[data-target="tabActive"]').click();
  } catch (err) {
    showToast("Could not post order: " + err.message);
  }
});

// ==========================================
// 6. RUNNER FEED (SAME-GENDER FILTERED)
// ==========================================
document.getElementById("runnerFilterBlock").addEventListener("change", (e) => {
  subscribeOpenOrders(e.target.value);
});

function subscribeOpenOrders(blockFilter) {
  if (unsubOpenOrders) unsubOpenOrders();
  const baseCol = collection(db, "orders");

  const q = blockFilter === "ALL"
    ? query(
        baseCol,
        where("status", "==", "OPEN"),
        where("targetGender", "==", userProfile.gender),
        orderBy("createdAt", "desc"),
        limit(50)
      )
    : query(
        baseCol,
        where("status", "==", "OPEN"),
        where("targetGender", "==", userProfile.gender),
        where("dropBlock", "==", blockFilter),
        orderBy("createdAt", "desc"),
        limit(50)
      );

  unsubOpenOrders = onSnapshot(q, (snap) => {
    const container = document.getElementById("openOrdersList");
    container.innerHTML = "";
    const otherDocs = snap.docs.filter((d) => d.data().buyerId !== currentUser.uid);
    if (otherDocs.length === 0) {
      container.innerHTML = `<p class="muted small">No open ${userProfile.gender === "MALE" ? "Boys" : "Ladies"} hostel requests right now.</p>`;
      return;
    }
    otherDocs.forEach((docSnap) => {
      const o = docSnap.data();
      const itemsText = o.items.map((i) => `${i.qty}x ${i.name}`).join(", ");
      const card = document.createElement("div");
      card.className = "order-item-card stack-sm";
      card.innerHTML = `
        <div class="row-between">
          <span class="tag-cerulean">${o.dropBlock} | ${o.distanceLabel || ""}</span>
          <span class="tag-rose mono">FEE ₹${o.tipAmount}</span>
        </div>
        <p class="small"><strong>Items:</strong> ${itemsText}</p>
        <p class="small muted">Est. Store Bill: ₹${o.estItemsTotal} | Buyer: ${o.buyerName}</p>
        <button class="btn btn-cerulean btn-block claim-btn">Claim Order (1 Credit)</button>
      `;
      card.querySelector(".claim-btn").onclick = () => claimOrderAtomically(docSnap.id);
      container.appendChild(card);
    });
  });
}

async function claimOrderAtomically(orderId) {
  if ((userProfile.runnerCredits || 0) < 1) {
    showToast("Insufficient credits. Top up in Runner Wallet.");
    document.querySelector('[data-target="tabWallet"]').click();
    return;
  }

  const userRef = doc(db, "users", currentUser.uid);
  const orderRef = doc(db, "orders", orderId);

  try {
    await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      const orderSnap = await tx.get(orderRef);

      if (!orderSnap.exists() || orderSnap.data().status !== "OPEN") {
        throw new Error("Order was already claimed.");
      }
      if (orderSnap.data().targetGender !== userProfile.gender) {
        throw new Error("Hostel zone mismatch.");
      }
      const credits = userSnap.data().runnerCredits || 0;
      if (credits < 1) throw new Error("Insufficient credits.");

      tx.update(userRef, { runnerCredits: credits - 1 });
      tx.update(orderRef, {
        status: "CLAIMED",
        runnerId: currentUser.uid,
        runnerName: userProfile.name,
        runnerPhone: userProfile.phone,
        runnerUpi: userProfile.upiId,
        claimedAt: serverTimestamp()
      });
    });
    showToast("Order claimed. 1 credit deducted.");
    document.querySelector('[data-target="tabActive"]').click();
  } catch (err) {
    showToast(err.message);
  }
}

// ==========================================
// 7. LIVE ACTIVE TRACKER
// ==========================================
function subscribeMyActiveOrders() {
  const activeStatuses = ["OPEN", "CLAIMED", "AT_GATE"];
  let buyerOrders = [];
  let runnerOrders = [];

  const renderCombined = () => {
    const container = document.getElementById("myActiveOrdersList");
    container.innerHTML = "";
    const all = [...buyerOrders, ...runnerOrders];
    if (all.length === 0) {
      container.innerHTML = `<p class="muted small">No active orders.</p>`;
      return;
    }

    all.forEach((o) => {
      const isBuyer = o.buyerId === currentUser.uid;
      const itemsText = o.items.map((i) => `${i.qty}x ${i.name}`).join(", ");
      const card = document.createElement("div");
      card.className = "order-item-card stack-sm";

      let roleControls = "";
      if (isBuyer) {
        const finalPay = (o.actualBillAmount || o.estItemsTotal) + o.tipAmount;
        const payLink = o.runnerUpi
          ? `upi://pay?pa=${encodeURIComponent(o.runnerUpi)}&pn=${encodeURIComponent(o.runnerName)}&am=${finalPay}&cu=INR`
          : "#";

        roleControls = `
          <div class="otp-banner mono">HANDOFF OTP: ${o.handoffOtp}</div>
          <p class="small"><strong>Drop Gate:</strong> ${o.dropBlock}</p>
          <p class="small"><strong>Runner:</strong> ${o.runnerName ? `${o.runnerName} (${o.runnerPhone})` : "Awaiting runner claim"}</p>
          ${o.actualBillAmount ? `<p class="small"><strong>Verified Bill:</strong> ₹${o.actualBillAmount} + ₹${o.tipAmount} fee = <strong class="mono text-rose">₹${finalPay}</strong></p>` : ""}
          ${o.receiptBase64 ? `<img src="${o.receiptBase64}" class="receipt-preview" alt="V-Mart Receipt" />` : ""}
          ${o.status === "AT_GATE" ? `<a href="${payLink}" class="btn btn-rose btn-block">Pay ₹${finalPay} via UPI</a>` : ""}
          ${o.status === "OPEN" ? `<button class="btn btn-outline btn-sm cancel-order-btn">Cancel Request</button>` : ""}
        `;
      } else {
        roleControls = `
          <p class="small"><strong>Buyer:</strong> ${o.buyerName} (${o.buyerPhone}) | Gate: <strong class="text-cerulean">${o.dropBlock}</strong></p>
          ${o.status === "CLAIMED" ? `
            <div class="stack-sm" style="background:var(--surface);padding:12px;border-radius:6px;border:1px solid var(--border);">
              <label>Actual V-Mart Receipt Total (₹)
                <input type="number" class="actual-bill-input" placeholder="Exact bill amount" min="1" max="500" />
              </label>
              <label>Upload Printed Receipt Photo
                <input type="file" accept="image/*" class="receipt-file-input" />
              </label>
              <button class="btn btn-cerulean btn-block mark-gate-btn">Submit Receipt &amp; Mark At Gate</button>
            </div>
          ` : `
            <p class="small">Collect <strong class="mono text-rose">₹${o.actualBillAmount + o.tipAmount}</strong> via UPI at gate, then enter buyer's 4-digit OTP:</p>
            <div class="custom-item-row">
              <input type="text" maxlength="4" class="otp-verify-input mono" placeholder="4-Digit OTP" />
              <span></span>
              <button class="btn btn-success complete-otp-btn">Confirm</button>
            </div>
          `}
        `;
      }

      card.innerHTML = `
        <div class="row-between">
          <span class="${isBuyer ? "tag-cerulean" : "tag-rose"}">${isBuyer ? "OUTGOING REQUEST" : "ACTIVE DELIVERY"}</span>
          <span class="tag-green">${o.status}</span>
        </div>
        <p class="small"><strong>Items:</strong> ${itemsText}</p>
        ${roleControls}
      `;

      const cancelBtn = card.querySelector(".cancel-order-btn");
      if (cancelBtn) {
        cancelBtn.onclick = async () => {
          await updateDoc(doc(db, "orders", o.id), { status: "CANCELLED" });
          showToast("Order cancelled.");
        };
      }

      const gateBtn = card.querySelector(".mark-gate-btn");
      if (gateBtn) {
        gateBtn.onclick = async () => {
          const billVal = Number(card.querySelector(".actual-bill-input").value);
          const file = card.querySelector(".receipt-file-input").files[0];
          if (!billVal || !file) return showToast("Enter bill amount and attach receipt photo.");
          gateBtn.disabled = true;
          gateBtn.textContent = "Uploading...";
          try {
            const compressed = await compressReceiptImage(file);
            await updateDoc(doc(db, "orders", o.id), {
              status: "AT_GATE",
              actualBillAmount: billVal,
              receiptBase64: compressed
            });
            showToast("Receipt uploaded.");
          } catch (err) {
            showToast("Upload error: " + err.message);
            gateBtn.disabled = false;
          }
        };
      }

      const otpBtn = card.querySelector(".complete-otp-btn");
      if (otpBtn) {
        otpBtn.onclick = async () => {
          const entered = card.querySelector(".otp-verify-input").value.trim();
          if (entered !== o.handoffOtp) return showToast("Invalid OTP.");
          await updateDoc(doc(db, "orders", o.id), {
            status: "COMPLETED",
            completedAt: serverTimestamp()
          });
          showToast("Delivery completed.");
        };
      }

      container.appendChild(card);
    });
  };

  unsubMyBuyerOrders = onSnapshot(
    query(collection(db, "orders"), where("buyerId", "==", currentUser.uid), where("status", "in", activeStatuses), limit(10)),
    (snap) => { buyerOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderCombined(); }
  );

  unsubMyRunnerOrders = onSnapshot(
    query(collection(db, "orders"), where("runnerId", "==", currentUser.uid), where("status", "in", activeStatuses), limit(10)),
    (snap) => { runnerOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderCombined(); }
  );
}

// ==========================================
// 8. RUNNER CREDIT WALLET (₹20 / ₹50 PACKS)
// ==========================================
document.querySelectorAll(".pack-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pack-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedPack = {
      packId: btn.dataset.pack,
      price: Number(btn.dataset.price),
      credits: Number(btn.dataset.credits)
    };
    document.getElementById("selectedPackPrice").textContent = `₹${selectedPack.price}`;
    updateUpiDeepLink();
  });
});

function updateUpiDeepLink() {
  if (!currentUser) return;
  const note = `CREDITS-${currentUser.uid.slice(0, 8)}`;
  document.getElementById("upiDeepLink").href =
    `upi://pay?pa=${encodeURIComponent(ADMIN_UPI_ID)}&pn=CampusCartVITC&am=${selectedPack.price}&cu=INR&tn=${encodeURIComponent(note)}`;
}

document.getElementById("copyUpiBtn").addEventListener("click", () => {
  navigator.clipboard.writeText(ADMIN_UPI_ID);
  showToast("UPI ID copied.");
});

document.getElementById("utrForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const utr = document.getElementById("utrInput").value.trim();
  if (!/^[0-9]{12}$/.test(utr)) return showToast("Enter a valid 12-digit UTR number.");

  try {
    const topupRef = doc(db, "topup_requests", utr);
    const existing = await getDoc(topupRef);
    if (existing.exists()) {
      return showToast("This UTR number has already been submitted.");
    }

    await setDoc(topupRef, {
      utrNumber: utr,
      uid: currentUser.uid,
      runnerName: userProfile.name,
      runnerEmail: currentUser.email,
      packId: selectedPack.packId,
      amountInr: selectedPack.price,
      creditsRequested: selectedPack.credits,
      status: "PENDING",
      submittedAt: serverTimestamp()
    });
    document.getElementById("utrInput").value = "";
    showToast("UTR submitted for verification.");
  } catch (err) {
    showToast("Submission failed: " + err.message);
  }
});

function subscribeMyTopups() {
  const q = query(collection(db, "topup_requests"), where("uid", "==", currentUser.uid), orderBy("submittedAt", "desc"), limit(10));
  onSnapshot(q, (snap) => {
    const list = document.getElementById("myTopupsList");
    if (snap.empty) return;
    list.innerHTML = "";
    snap.docs.forEach((d) => {
      const t = d.data();
      const div = document.createElement("div");
      div.className = "row-between";
      div.innerHTML = `<span class="mono">UTR ${t.utrNumber} (₹${t.amountInr} | ${t.creditsRequested} cr)</span><strong class="${t.status === "APPROVED" ? "text-cerulean" : "text-rose"}">${t.status}</strong>`;
      list.appendChild(div);
    });
  });
}

// ==========================================
// 9. ADMIN PANEL
// ==========================================
function initAdminListeners() {
  const topupQ = query(collection(db, "topup_requests"), where("status", "==", "PENDING"), limit(30));
  onSnapshot(topupQ, (snap) => {
    const queue = document.getElementById("adminTopupQueue");
    queue.innerHTML = snap.empty ? `<p class="muted small">No pending UTR requests.</p>` : "";
    snap.docs.forEach((docSnap) => {
      const t = docSnap.data();
      const card = document.createElement("div");
      card.className = "order-item-card stack-sm";
      card.innerHTML = `
        <div class="row-between"><strong>${t.runnerName}</strong><span class="tag-rose mono">₹${t.amountInr} | +${t.creditsRequested} CR</span></div>
        <p class="small">UTR: <code>${t.utrNumber}</code> | ${t.runnerEmail}</p>
        <div class="row-between">
          <button class="btn btn-success btn-sm approve-btn">Approve</button>
          <button class="btn btn-rose btn-sm reject-btn">Reject</button>
        </div>
      `;
      card.querySelector(".approve-btn").onclick = async () => {
        await runTransaction(db, async (tx) => {
          const uRef = doc(db, "users", t.uid);
          const uSnap = await tx.get(uRef);
          const cur = uSnap.data().runnerCredits || 0;
          tx.update(uRef, { runnerCredits: cur + t.creditsRequested });
          tx.update(doc(db, "topup_requests", docSnap.id), { status: "APPROVED", reviewedAt: serverTimestamp() });
        });
        showToast(`Credited +${t.creditsRequested} to ${t.runnerName}`);
      };
      card.querySelector(".reject-btn").onclick = async () => {
        await updateDoc(doc(db, "topup_requests", docSnap.id), { status: "REJECTED", reviewedAt: serverTimestamp() });
        showToast("Request rejected.");
      };
      queue.appendChild(card);
    });
  });

  document.getElementById("adminCatalogForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("newCatName").value.trim();
    const approxPrice = Number(document.getElementById("newCatPrice").value);
    const imageUrl = document.getElementById("newCatImage").value.trim();
    await addDoc(collection(db, "catalog"), {
      name,
      approxPrice,
      imageUrl: imageUrl || null,
      inStock: true
    });
    document.getElementById("newCatName").value = "";
    document.getElementById("newCatPrice").value = "";
    document.getElementById("newCatImage").value = "";
    showToast("Catalog item added.");
  });

  onSnapshot(query(collection(db, "catalog"), limit(60)), (snap) => {
    const list = document.getElementById("adminCatalogList");
    list.innerHTML = "";
    snap.docs.forEach((d) => {
      const item = d.data();
      const row = document.createElement("div");
      row.className = "row-between";
      row.innerHTML = `
        <span class="small">${item.name} <strong class="mono text-cerulean">(₹${item.approxPrice})</strong></span>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm ${item.inStock ? "btn-cerulean" : "btn-outline"} toggle-stock-btn">
            ${item.inStock ? "In Stock" : "Out"}
          </button>
          <button class="btn btn-sm btn-rose del-cat-btn">Delete</button>
        </div>
      `;
      row.querySelector(".toggle-stock-btn").onclick = () => updateDoc(doc(db, "catalog", d.id), { inStock: !item.inStock });
      row.querySelector(".del-cat-btn").onclick = () => deleteDoc(doc(db, "catalog", d.id));
      list.appendChild(row);
    });
  });
}
