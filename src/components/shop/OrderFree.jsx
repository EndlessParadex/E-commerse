import { freeNote } from '../../data/orderFree';
import './OrderFree.css';

/** The free units of an order line, shown under its quantity. */
export default function OrderFree({ item }) {
  const note = freeNote(item);
  return note ? (
    <span className="order-item-free">
      <span aria-hidden="true">🎁</span> {note}
    </span>
  ) : null;
}
