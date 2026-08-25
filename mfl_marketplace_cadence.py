MFL_PLAYER_TYPE_IDENTIFIER = "A.8ebcbfd516b1da27.MFLPlayer.NFT"
MFL_PLAYER_CONTRACT = "0x8ebcbfd516b1da27"
NFT_STOREFRONT_CONTRACT = "0x4eb8a10cb9f87357"

PLAYER_LISTINGS_PAGE_SCRIPT = """
import NonFungibleToken from 0x1d7e57aa55817448
import MFLPlayer from 0x8ebcbfd516b1da27
import NFTStorefront from 0x4eb8a10cb9f87357
import NFTStorefrontV2 from 0x4eb8a10cb9f87357

access(all) struct PlayerListing {
    access(all) let playerId: UInt64
    access(all) let price: UFix64
    access(all) let listingResourceId: UInt64
    access(all) let storefrontVersion: String

    init(
        playerId: UInt64,
        price: UFix64,
        listingResourceId: UInt64,
        storefrontVersion: String
    ) {
        self.playerId = playerId
        self.price = price
        self.listingResourceId = listingResourceId
        self.storefrontVersion = storefrontVersion
    }
}

access(all) struct ListingPage {
    access(all) let listings: [PlayerListing]
    access(all) let v1Count: Int
    access(all) let v2Count: Int

    init(listings: [PlayerListing], v1Count: Int, v2Count: Int) {
        self.listings = listings
        self.v1Count = v1Count
        self.v2Count = v2Count
    }
}

access(all) fun main(
    owner: Address,
    v1Offset: Int,
    v2Offset: Int,
    limit: Int
): ListingPage {
    let account = getAccount(owner)
    let playerCollection = account.capabilities.borrow<&{NonFungibleToken.CollectionPublic}>(
        MFLPlayer.CollectionPublicPath
    )
    let results: [PlayerListing] = []
    var v1Count = 0
    var v2Count = 0

    if let storefront = account.capabilities.borrow<&{NFTStorefront.StorefrontPublic}>(
        NFTStorefront.StorefrontPublicPath
    ) {
        let listingIDs = storefront.getListingIDs()
        v1Count = listingIDs.length
        var index = 0
        for listingResourceId in listingIDs {
            if index >= v1Offset && index < v1Offset + limit {
                if let listing = storefront.borrowListing(listingResourceID: listingResourceId) {
                    let details = listing.getDetails()
                    if details.nftType == Type<@MFLPlayer.NFT>() {
                        if let collection = playerCollection {
                            if collection.borrowNFT(details.nftID) != nil {
                                results.append(PlayerListing(
                                    playerId: details.nftID,
                                    price: details.salePrice,
                                    listingResourceId: listingResourceId,
                                    storefrontVersion: "v1"
                                ))
                            }
                        }
                    }
                }
            }
            index = index + 1
            if index >= v1Offset + limit {
                break
            }
        }
    }

    if let storefrontV2 = account.capabilities.borrow<&{NFTStorefrontV2.StorefrontPublic}>(
        NFTStorefrontV2.StorefrontPublicPath
    ) {
        let listingIDs = storefrontV2.getListingIDs()
        v2Count = listingIDs.length
        var index = 0
        for listingResourceId in listingIDs {
            if index >= v2Offset && index < v2Offset + limit {
                if let listing = storefrontV2.borrowListing(listingResourceID: listingResourceId) {
                    let details = listing.getDetails()
                    if details.nftType == Type<@MFLPlayer.NFT>() {
                        if let collection = playerCollection {
                            if collection.borrowNFT(details.nftID) != nil {
                                results.append(PlayerListing(
                                    playerId: details.nftID,
                                    price: details.salePrice,
                                    listingResourceId: listingResourceId,
                                    storefrontVersion: "v2"
                                ))
                            }
                        }
                    }
                }
            }
            index = index + 1
            if index >= v2Offset + limit {
                break
            }
        }
    }

    return ListingPage(
        listings: results,
        v1Count: v1Count,
        v2Count: v2Count
    )
}
"""
