import React from 'react';
import './PageHeader.css';

/**
 * Unified page header component
 * Props:
 *  - icon: material icon name
 *  - title: main heading text
 *  - description: subtitle text
 *  - actions: node (buttons etc.) displayed on the right (before rightContent)
 *  - rightContent: custom right side content (e.g., user badge)
 */
const PageHeader = ({ icon, title, description, actions, rightContent }) => {
  return (
    <div className="page-header">
      <div className="header-content">
        <div className="title-section">
          <h1>
            {icon && <span className="material-icons">{icon}</span>}
            {title}
          </h1>
          {description && <p>{description}</p>}
        </div>
        {(actions || rightContent) && (
          <div className="header-actions">
            {actions && <div className="header-buttons">{actions}</div>}
            {rightContent && <div className="header-right-extra">{rightContent}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
