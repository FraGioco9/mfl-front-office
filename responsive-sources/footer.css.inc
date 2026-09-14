

/* Issue #603: intentional responsive footer presentation. */
@media (max-width: 900px) {
  .siteFooterDetails {
    margin-top: 18px;
    padding: 16px 0 12px;
  }

  .siteFooterDetailsInner {
    grid-template-columns: minmax(200px, 0.9fr) minmax(0, 1.1fr);
    gap: 18px;
  }

  .siteFooterDetailsNavigation {
    gap: 12px;
  }

  .siteFooterDetailsIdentity p,
  .siteFooterDetailsCreatorDiscord,
  .siteFooterDetailsGroup a {
    font-size: 10px;
  }
}

@media (max-width: 520px) {
  .siteFooterDetails {
    margin-top: 14px;
    padding: 14px 0 10px;
  }

  .siteFooterDetailsInner {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .siteFooterDetailsNavigation {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .siteFooterDetailsTitle {
    font-size: 12px;
  }

  .siteFooterDetailsIdentity p {
    max-width: none;
    font-size: 9px;
  }

  .siteFooterDetailsGroup > span {
    font-size: 8px;
  }

  .siteFooterDetailsGroup a {
    font-size: 9px;
  }

  .siteFooterDetails a[href="/changelog"],
  .siteFooterDetails a[data-page="changelog"] {
    font-size: 10px;
  }

  .siteFooterDetailsMeta {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 5px 10px;
    font-size: 8px;
  }

  .siteFooterDetailsDisclaimer {
    grid-column: 1 / -1;
    grid-row: 2;
    text-align: left;
  }
}

@media (max-width: 380px) {
  .siteFooterDetails {
    margin-top: 12px;
    padding: 12px 0 9px;
  }

  .siteFooterDetailsInner {
    gap: 8px;
  }

  .siteFooterDetailsNavigation {
    gap: 7px;
  }

  .siteFooterDetailsTitle {
    font-size: 11px;
  }

  .siteFooterDetailsIdentity p,
  .siteFooterDetailsCreatorDiscord,
  .siteFooterDetailsGroup a {
    font-size: 8px;
  }

  .siteFooterDetails a[href="/changelog"],
  .siteFooterDetails a[data-page="changelog"] {
    font-size: 9px;
  }

  .siteFooterDetailsGroup > span {
    font-size: 7px;
  }

  .siteFooterDetailsMeta {
    grid-template-columns: 1fr;
    gap: 3px;
    font-size: 8px;
  }

  .siteFooterDetailsDisclaimer {
    grid-column: 1;
    grid-row: auto;
  }
}
