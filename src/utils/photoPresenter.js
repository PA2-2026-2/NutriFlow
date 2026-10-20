async function presentPhoto(photoStorage, user) {
  const profilePhotoUrl = user.profilePhotoUrl
    ? photoStorage?.getUrl
      ? await photoStorage.getUrl(user.profilePhotoUrl)
      : user.profilePhotoUrl
    : null;

  return { ...user, profilePhotoUrl };
}

async function getPhotoUrl(photoStorage, reference) {
  if (!reference) {
    return null;
  }

  return photoStorage?.getUrl
    ? photoStorage.getUrl(reference)
    : reference;
}

module.exports = {
  presentPhoto,
  getPhotoUrl,
};
