const COMMUNITY_INBOX_ROOM = "community-inbox";

let communityInboxIo = null;

const setCommunityInboxIo = (io) => {
  communityInboxIo = io;
};

const emitCommunityInbox = (event, payload) => {
  if (!communityInboxIo) return;
  communityInboxIo.to(COMMUNITY_INBOX_ROOM).emit(event, payload);
};

module.exports = {
  COMMUNITY_INBOX_ROOM,
  setCommunityInboxIo,
  emitCommunityInbox,
};
