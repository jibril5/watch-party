const fileInput = document.getElementById("fileInput");
const video = document.getElementById("video");

fileInput.addEventListener("change", (event) => {

  const file = event.target.files[0];

  if (!file) return;

  const videoURL = URL.createObjectURL(file);

  video.src = videoURL;

  video.play();

});