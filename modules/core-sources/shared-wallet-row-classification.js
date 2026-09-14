function linkedWalletAddressesForOwnedPlayers() {
  return new Set([state.linkedWalletAddress, state.linkedWalletProof?.signingAddress, state.linkedWalletProof?.address]
    .map((address) => normalizeWalletAddress(address).toLowerCase())
    .filter(Boolean));
}



function rowIsMflWalletPlayer(row) {
  const walletAddress = normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase();
  const walletName = normalizedAgentName(getValue(row, "wallet_name")).toLowerCase();
  return walletAddress === mflWalletAddress || walletName === "mfl";
}

function rowHasHiddenMflJoinedAgencyDate(row) {
  if (state?.currentPage === "club" || /^\/(?:clubs|club)\/[^/]+(?:\/|$)/i.test(window.location.pathname)) return false;
  if (!rowIsMflWalletPlayer(row)) {
    return false;
  }

  const joinedDay = ownedSinceDay(row);
  return joinedDay !== null && [parseFilterDateDay("2025-10-09"), parseFilterDateDay("2025-10-10")].includes(joinedDay);
}
