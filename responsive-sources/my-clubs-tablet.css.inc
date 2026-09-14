@media (max-width: 900px) {
  .myClubsGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .myClubCard {
    grid-template-columns: 96px minmax(0, 1fr);
    min-height: 120px;
  }

  .myClubLogoFrame {
    padding: 9px;
  }

  .myClubLogo {
    max-width: 76px;
    max-height: 84px;
  }

  .myClubCardBody {
    padding: 11px 12px;
  }

  .myClubName {
    font-size: 18px;
  }

  .myClubId {
    font-size: 12px;
  }

  .myClubMeta {
    font-size: 13px;
  }

  .myClubCompetition {
    gap: 8px;
    font-size: 12px;
  }
}
