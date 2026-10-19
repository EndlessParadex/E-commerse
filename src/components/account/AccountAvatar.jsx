import { useState } from 'react';
import { ActionIcon } from '../shop/ShopIcon';
import './AccountAvatar.css';

function AvatarImage({ user }) {
  const [failed, setFailed] = useState(false);
  return user?.avatar && !failed ? (
    <img src={user.avatar} alt="" onError={() => setFailed(true)} />
  ) : user?.name ? (
    user.name.slice(0, 1).toLocaleUpperCase('id')
  ) : (
    <ActionIcon account />
  );
}

export default function AccountAvatar({ user, className = '' }) {
  return (
    <div className={`account-avatar ${className}`} aria-hidden="true">
      <AvatarImage key={user?.avatar || user?.id || 'guest'} user={user} />
    </div>
  );
}
