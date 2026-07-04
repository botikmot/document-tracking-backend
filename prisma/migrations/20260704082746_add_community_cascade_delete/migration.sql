-- DropForeignKey
ALTER TABLE "CommunityMember" DROP CONSTRAINT "CommunityMember_communityId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityMessage" DROP CONSTRAINT "CommunityMessage_communityId_fkey";

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMessage" ADD CONSTRAINT "CommunityMessage_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
