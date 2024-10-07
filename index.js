document.querySelectorAll("button")[0].addEventListener("click", shuffleAll);
document.querySelectorAll("button")[1].addEventListener("click", shuffleTops);
document.querySelectorAll("button")[2].addEventListener("click", shuffleBottoms);
document.querySelectorAll("button")[3].addEventListener("click", shuffleJackets);

function shuffleAll() {
    var button = document.querySelectorAll("button")[0];
    document.querySelectorAll("button")[1].click();
    document.querySelectorAll("button")[2].click();
    document.querySelectorAll("button")[3].click();
}

function shuffleTops() {
    var button = document.querySelectorAll("button")[1];
    var tops = document.querySelectorAll(".tops");
    var activeTop = document.querySelector("#carouselTops .active .tops");
    var numTops = tops.length;
    var randomTop = Math.floor(Math.random() * numTops);
    button.setAttribute("data-bs-slide-to", "" + randomTop + "");
}

function shuffleBottoms() {
    var button = document.querySelectorAll("button")[2];
    var bottoms = document.querySelectorAll(".bottoms");
    var activeBottoms = document.querySelector("#carouselBottoms .active .bottoms");
    var numBottoms = bottoms.length;
    var randomBottoms = Math.floor(Math.random() * numBottoms);

    button.setAttribute("data-bs-slide-to", "" + randomBottoms + "");
}

function shuffleJackets() {
    var button = document.querySelectorAll("button")[3];
    var jackets = document.querySelectorAll(".jackets");
    var numJackets = jackets.length;
    var randomBottoms = Math.floor(Math.random() * numJackets);

    button.setAttribute("data-bs-slide-to", "" + randomBottoms + "");
}
