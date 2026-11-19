import { db, now } from '../db.js';
import { conflict } from './errors.js';

/** The only allowed moves. Anything else is 409 and writes nothing. */
export const SELLER_MOVES = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
export const BUYER_MOVES = {
  placed: ['cancelled'],
  confirmed: ['cancelled'],
  shipped: [],
  delivered: [],
  cancelled: [],
};

const updateStatus = db.prepare('UPDATE seller_orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?');
const insertHistory = db.prepare(
  'INSERT INTO status_history (seller_order_id, from_status, to_status, changed_by, created_at) VALUES (?, ?, ?, ?, ?)');
const restoreStock = db.prepare(`
  UPDATE products SET stock = stock + (
    SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.seller_order_id = ? AND oi.product_id = products.id
  ), updated_at = ?
  WHERE id IN (SELECT product_id FROM order_items WHERE seller_order_id = ?)`);

/** Must be called inside a write transaction. `so` is the seller_orders row read in that transaction. */
export function moveSellerOrder(so, to, actor, userId) {
  const moves = actor === 'seller' ? SELLER_MOVES : BUYER_MOVES;
  if (!(moves[so.status] || []).includes(to)) {
    throw conflict('MOVE_NOT_ALLOWED', `An order that is "${so.status}" cannot be moved to "${to}"`);
  }
  const t = now();
  const r = updateStatus.run(to, t, so.id, so.status);
  if (r.changes !== 1) throw conflict('MOVE_NOT_ALLOWED', 'The order changed in the meantime, please reload');
  insertHistory.run(so.id, so.status, to, userId, t);
  if (to === 'cancelled') restoreStock.run(so.id, t, so.id); // same transaction as the status change
}

export function historyFor(sellerOrderIds) {
  if (!sellerOrderIds.length) return {};
  const rows = db.prepare(`
    SELECT h.seller_order_id, h.from_status, h.to_status, h.created_at, u.name AS changed_by_name,
           CASE WHEN so.seller_id = h.changed_by THEN 'seller' ELSE 'buyer' END AS changed_by_role
    FROM status_history h
    JOIN seller_orders so ON so.id = h.seller_order_id
    JOIN users u ON u.id = h.changed_by
    WHERE h.seller_order_id IN (${sellerOrderIds.map(() => '?').join(',')})
    ORDER BY h.id`).all(...sellerOrderIds);
  const out = {};
  for (const r of rows) {
    (out[r.seller_order_id] ||= []).push({
      from: r.from_status, to: r.to_status, at: r.created_at, by: r.changed_by_name, role: r.changed_by_role,
    });
  }
  return out;
}
