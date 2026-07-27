import type { Closet, ClosetItem } from "./types";

/**
 * The closet manifest. Adding an item = drop a PNG in `public/images/<category>/`
 * and add one entry here (Decision 3).
 *
 * Not exported: everything reads the closet through `getCloset()` / `getItem()`.
 * That indirection is the seam for the planned in-app-upload feature — uploaded
 * items merge into `getCloset()`'s return value in one place and every consumer
 * (shuffle, rails, validity, previews) keeps working unchanged.
 */
const CLOSET: Closet = {
  tops: [
    {
      id: "top-shirt-1",
      name: "Shirt 1",
      category: "tops",
      image: "/images/tops/shirt1.png",
    },
    {
      id: "top-shirt-2",
      name: "Shirt 2",
      category: "tops",
      image: "/images/tops/shirt2.png",
    },
    {
      id: "top-shirt-3",
      name: "Shirt 3",
      category: "tops",
      image: "/images/tops/shirt3.png",
    },
    {
      id: "top-shirt-4",
      name: "Shirt 4",
      category: "tops",
      image: "/images/tops/shirt4.png",
    },
    {
      id: "top-shirt-5",
      name: "Shirt 5",
      category: "tops",
      image: "/images/tops/shirt5.png",
    },
    {
      id: "top-shirt-6",
      name: "Shirt 6",
      category: "tops",
      image: "/images/tops/shirt6.png",
    },
    {
      id: "top-tank-1",
      name: "Tank 1",
      category: "tops",
      image: "/images/tops/tank1.png",
    },
    {
      id: "top-tank-2",
      name: "Tank 2",
      category: "tops",
      image: "/images/tops/tank2.png",
    },
    {
      id: "top-tank-3",
      name: "Tank 3",
      category: "tops",
      image: "/images/tops/tank3.png",
    },
    {
      id: "top-tank-4",
      name: "Tank 4",
      category: "tops",
      image: "/images/tops/tank4.png",
    },
    {
      id: "top-tank-5",
      name: "Tank 5",
      category: "tops",
      image: "/images/tops/tank5.png",
    },
    {
      id: "top-tank-6",
      name: "Tank 6",
      category: "tops",
      image: "/images/tops/tank6.png",
    },
    {
      id: "top-tank-7",
      name: "Tank 7",
      category: "tops",
      image: "/images/tops/tank7.png",
    },
    {
      id: "top-tank-8",
      name: "Tank 8",
      category: "tops",
      image: "/images/tops/tank8.png",
    },
    {
      id: "top-sweater-1",
      name: "Sweater 1",
      category: "tops",
      image: "/images/tops/sweater1.png",
    },
  ],

  bottoms: [
    {
      id: "bottom-pants-1",
      name: "Pants 1",
      category: "bottoms",
      image: "/images/bottoms/pants1.png",
    },
    {
      id: "bottom-pants-2",
      name: "Pants 2",
      category: "bottoms",
      image: "/images/bottoms/pants2.png",
    },
    {
      id: "bottom-pants-3",
      name: "Pants 3",
      category: "bottoms",
      image: "/images/bottoms/pants3.png",
    },
    {
      id: "bottom-pants-4",
      name: "Pants 4",
      category: "bottoms",
      image: "/images/bottoms/pants4.png",
    },
    {
      id: "bottom-pants-5",
      name: "Pants 5",
      category: "bottoms",
      image: "/images/bottoms/pants5.png",
    },
    {
      id: "bottom-pants-6",
      name: "Pants 6",
      category: "bottoms",
      image: "/images/bottoms/pants6.png",
    },
    {
      id: "bottom-pants-7",
      name: "Pants 7",
      category: "bottoms",
      image: "/images/bottoms/pants7.png",
    },
    {
      id: "bottom-skirt-1",
      name: "Skirt 1",
      category: "bottoms",
      image: "/images/bottoms/skirt1.png",
    },
    {
      id: "bottom-skirt-2",
      name: "Skirt 2",
      category: "bottoms",
      image: "/images/bottoms/skirt2.png",
    },
    {
      id: "bottom-skirt-3",
      name: "Skirt 3",
      category: "bottoms",
      image: "/images/bottoms/skirt3.png",
    },
    {
      id: "bottom-shorts-1",
      name: "Shorts 1",
      category: "bottoms",
      image: "/images/bottoms/shorts1.png",
    },
    {
      id: "bottom-shorts-2",
      name: "Shorts 2",
      category: "bottoms",
      image: "/images/bottoms/shorts2.png",
    },
    {
      id: "bottom-shorts-3",
      name: "Shorts 3",
      category: "bottoms",
      image: "/images/bottoms/shorts3.png",
    },
    {
      id: "bottom-shorts-4",
      name: "Shorts 4",
      category: "bottoms",
      image: "/images/bottoms/shorts4.png",
    },
  ],

  // No dress images yet. The slot model, shuffle rules and rail all handle dresses
  // (Decisions 7 & 8) — dropping a PNG here plus one entry activates the UI.
  dresses: [],

  jackets: [
    {
      id: "jacket-1",
      name: "Jacket 1",
      category: "jackets",
      image: "/images/jackets/jacket1.png",
    },
    {
      id: "jacket-2",
      name: "Jacket 2",
      category: "jackets",
      image: "/images/jackets/jacket2.png",
    },
    {
      id: "jacket-3",
      name: "Jacket 3",
      category: "jackets",
      image: "/images/jackets/jacket3.png",
    },
  ],

  shoes: [
    {
      id: "shoes-1",
      name: "Shoes 1",
      category: "shoes",
      image: "/images/shoes/shoes1.png",
    },
  ],

  accessories: [
    {
      id: "accessory-bag-1",
      name: "Bag 1",
      category: "accessories",
      image: "/images/accessories/bag1.png",
    },
  ],
};

const ITEMS_BY_ID = new Map<string, ClosetItem>(
  Object.values(CLOSET)
    .flat()
    .map((item) => [item.id, item]),
);

export function getCloset(): Closet {
  return CLOSET;
}

export function getItem(id: string): ClosetItem | undefined {
  return ITEMS_BY_ID.get(id);
}
