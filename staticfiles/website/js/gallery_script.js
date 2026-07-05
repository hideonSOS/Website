const modal = document.getElementById("modal");
    const modalImg = document.getElementById("modal-img");

    function openModal(src) {
      modalImg.src = src;
      modal.classList.add("active");
    }

    function closeModal() {
      modal.classList.remove("active");
      modalImg.src = "";
    }

    // ESCキーで閉じる
    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape") {
        closeModal();
      }
    });