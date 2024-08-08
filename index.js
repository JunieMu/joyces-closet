document.querySelectorAll("button")[0].addEventListener("click", shuffleAll);
document.querySelectorAll("button")[1].addEventListener("click", shuffleTops);
document.querySelectorAll("button")[2].addEventListener("click", shuffleBottoms);

function shuffleAll() {
    var button = document.querySelectorAll("button")[0];
    document.querySelectorAll("button")[1].click();
    document.querySelectorAll("button")[2].click();
}

function shuffleTops() {
    var button = document.querySelectorAll("button")[1];
    var tops = document.querySelectorAll(".tops");
    var activeTop = document.querySelector("#carouselTops .active .tops");
    var numTops = tops.length;
    var randomTop = Math.floor(Math.random() * numTops);
    button.setAttribute("data-bs-slide-to", "" + randomTop + "");
}

function shuffleBottoms(button) {
    var button = document.querySelectorAll("button")[2];
    var bottoms = document.querySelectorAll(".bottoms");
    var activeBottoms = document.querySelector("#carouselBottoms .active .bottoms");
    var numBottoms = bottoms.length;
    var randomBottoms = Math.floor(Math.random() * numBottoms);

    button.setAttribute("data-bs-slide-to", "" + randomBottoms + "");
}
