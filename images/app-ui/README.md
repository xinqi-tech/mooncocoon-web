# App UI assets

Copied unchanged from Aildo-Android/ui/src/main/res.

- `gift-open.webp`: `drawable-nodpi/ic_daily_task_giftbox_open.webp`
- `gift-closed.webp`: `drawable-nodpi/ic_daily_task_giftbox_unopened.webp`
- `sound-on.png`: `drawable-nodpi/ic_sound_on.png`
- `sound-off.png`: `drawable-nodpi/ic_sound_off.png`
- `down.png`: `drawable-nodpi/schedule_filter_btn_arrow.png`
- `right.png`: `drawable-nodpi/mall_sub_arrow_right.png`
- `close.webp`: `drawable-xxxhdpi/ic_gift_share_close.webp`

Gift states illustrate milestone locked/unlocked; they do not imply a user has claimed a reward.

- `title-plate.webp`: `drawable-nodpi/recharge_help_heading.webp`
- `star-divider.png`: `drawable-nodpi/affection_rules_divider.png`

`title-slice-0.png` … `title-slice-8.png`: Figma J56l6Cs090O8z8aZU1AqQC node 40000741:48072, original exported slices in row-major order. Three columns; fixed end caps, stretchable center.



`title-column-left.svg`, `title-column-middle.svg`, `title-column-right.svg`: separate columns assembled from the original PNG slice bytes (unchanged). title-plates.js inserts three img elements: end caps use intrinsic aspect ratio and fixed flex size, middle uses flex:1 and preserveAspectRatio=none. No complete-plate image is stretched.

`product-title-{left,middle,right}.png`: Figma node 40000750:48411. `product-subtitle-{left,middle,right}.png`: node 40000750:48423. Original exports unchanged; caps preserve aspect ratio, only middle flexes.

`gift-base.png`: Figma node 40000750:48425 / child 40000750:48424, original image export; contained beneath the gift without resizing the gift itself.


Product title columns now display their full transparent canvas outside an 80px visible artwork band (original visible band 100px). This preserves butterflies and glow without clipping; end caps retain aspect ratio.
