const btn = document.querySelector(".btn-open");
const form = document.querySelector(".fact-form"); // Corrected the selector

btn.addEventListener("click", function () {
  if (form.classList.contains("hidden")) {
    form.classList.remove("hidden");
    btn.textContent = "Close";
  } else {
    form.classList.add("hidden");
    btn.textContent = "Share an ambrosia infestation place";
  }
});

function openLoginForm() {
  document.getElementById("loginContainer").style.display = "block";
  document.getElementById("overlay").style.display = "block";
}

// Function to close the login form
function closeLoginForm() {
  document.getElementById("loginContainer").style.display = "none";
  document.getElementById("overlay").style.display = "none";
}

const scrollToTopBtn = document.getElementById("scrollToTopBtn");

// Show or hide the button based on the scroll position
window.addEventListener("scroll", function () {
  if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
    scrollToTopBtn.style.display = "block";
  } else {
    scrollToTopBtn.style.display = "none";
  }
});

// Scroll to the top when the button is clicked
scrollToTopBtn.addEventListener("click", function () {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
});
