import AdminIcon from './AdminIcon';

export default function AdminSectionIcon({ name }) {
  return (
    <span className={'admin-unified-section-icon admin-unified-section-icon--' + name}>
      <AdminIcon name={name} />
    </span>
  );
}
