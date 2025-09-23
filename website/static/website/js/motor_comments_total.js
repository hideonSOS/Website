
const select = document.getElementById("titleFilter");
const posts = document.querySelectorAll("#postList .post");

select.addEventListener("change", () => {
    const value = select.value;
    posts.forEach(post => {
    if (!value || post.dataset.title === value) {
        post.style.display = "block";
    } else {
        post.style.display = "none";
    }
    });
});
