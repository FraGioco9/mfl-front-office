@media (max-width: 640px) {
  .myClubsGrid {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .myClubCard {
    grid-template-columns: 104px minmax(0, 1fr);
    min-height: 128px;
  }

  .myClubLogoFrame {
    padding: 10px;
  }

  .myClubLogo {
    max-width: 82px;
    max-height: 90px;
  }

  .myClubCardBody {
    padding: 12px 13px;
  }

  .myClubName {
    font-size: 19px;
  }

  .myClubId {
    font-size: 12px;
  }

  .myClubMeta {
    font-size: 14px;
  }

  .myClubCompetition {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
  }

  .myClubCompetitionStanding {
    white-space: normal;
  }
}
