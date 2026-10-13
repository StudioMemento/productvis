import { IconX } from '@tabler/icons-react';
import { Tool } from './Controls.jsx';

export function TechnicalPanel({id,title,onClose,children}) {
  return <section className="technical-panel category" id={`controls-${id}`} role="region" aria-label={title}>
    <header className="technical-heading"><h2>{title}</h2><Tool label={`Chiudi ${title}`} onClick={onClose}><IconX size={19}/></Tool></header>
    <div className="technical-content dropdown-scroll">{children}</div>
  </section>;
}
