import { useState } from 'react';
import useCompany from '../../state/useCompany';
import './CompanyBrand.css';

function BrandLogo({ src }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : <img className="company-brand-logo" src={src} alt="" aria-hidden="true" onError={() => setFailed(true)} />;
}

export default function CompanyBrand({ className = '' }) {
  const { profile } = useCompany();
  return <span className={'company-brand ' + className}>
    {profile.logo && <BrandLogo key={profile.logo} src={profile.logo} />}
    <span className="company-brand-text">{profile.shortName}{profile.shortName === 'BAM' && <span className="logo-accent">.</span>}</span>
  </span>;
}
