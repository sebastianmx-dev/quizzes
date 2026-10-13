// Liga a app ao Firebase: Firestore para os dados, login anónimo para alunos e Google para gestores.
// Expõe window.QBackend = { db, auth } com a mesma forma que app.js usa.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  onSnapshot, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

function publish(b) {
  window.QBackend = b;
  window.dispatchEvent(new Event("qbackend"));
}

function start() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || String(cfg.apiKey).indexOf("COLA_AQUI") === 0) {
    publish({ error: "config" });
    return;
  }
  const app = initializeApp(cfg);
  const fs = getFirestore(app);
  const auth = getAuth(app);

  const wrapDoc = (s) => ({
    id: s.id,
    exists: s.exists(),
    data: () => s.data(),
    metadata: { fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites }
  });
  const wrapQuery = (qs) => {
    const docs = qs.docs.map(wrapDoc);
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} };
  };
  const D = (ref) => ({
    id: ref.id,
    path: ref.path,
    get: () => getDoc(ref).then(wrapDoc),
    set: (d) => setDoc(ref, d),
    update: (d) => updateDoc(ref, d),
    delete: () => deleteDoc(ref),
    onSnapshot: (next, err) => onSnapshot(ref, (s) => next(wrapDoc(s)), (e) => err && err(e)),
    collection: (p) => C(collection(ref, p))
  });
  const Q = (q) => ({
    where: (f, op, v) => Q(query(q, where(f, op, v))),
    orderBy: (f, dir) => Q(query(q, orderBy(f, dir || "asc"))),
    limit: (n) => Q(query(q, limit(n))),
    get: () => getDocs(q).then(wrapQuery),
    onSnapshot: (next, err) => onSnapshot(q, (s) => next(wrapQuery(s)), (e) => err && err(e))
  });
  const C = (ref) => {
    const o = Q(ref);
    o.path = ref.path;
    o.doc = (id) => D(id ? doc(ref, id) : doc(ref));
    o.add = (d) => addDoc(ref, d).then((r) => D(r));
    return o;
  };
  const db = { doc: (p) => D(doc(fs, p)), collection: (p) => C(collection(fs, p)) };

  let state = { uid: null, email: null, isAdmin: false, error: "" };
  const listeners = new Set();
  const emit = () => listeners.forEach((cb) => { try { cb(state); } catch (e) { console.error(e); } });
  const api = {
    get: () => state,
    onChange: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    signInGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signOut: () => signOut(auth)
  };

  let published = false;
  const ready = () => { if (!published) { published = true; publish({ db, auth: api }); } };
  setTimeout(ready, 8000);

  onAuthStateChanged(auth, async (u) => {
    if (!u) {
      try { await signInAnonymously(auth); }
      catch (e) {
        state = { uid: null, email: null, isAdmin: false, error: "o login anónimo não está ativo no Firebase (" + (e.code || e.message) + ")." };
        ready(); emit();
      }
      return;
    }
    let isAdmin = false;
    if (!u.isAnonymous && u.email) {
      try { isAdmin = (await getDoc(doc(fs, "admins", u.email))).exists(); } catch (e) { isAdmin = false; }
    }
    state = { uid: u.uid, email: u.isAnonymous ? null : (u.email || null), isAdmin, error: "" };
    ready(); emit();
  });
}

if (!window.QBackend) {
  try { start(); }
  catch (e) { publish({ error: "init", message: e && e.message }); }
}
