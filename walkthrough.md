# Walkthrough: Automatic BPMN Swimlane Layout Wrapping & Interface Enhancements

This walkthrough describes the implementation of automatic flowchart wrapping using synthesized BPMN Link Intermediate Events (Off-Page Connectors), read-only viewer lockdown with dynamic viewbox fit-width scaling, dynamic swimlane sizing for margin symmetry, and dashboard/editor action button cleanup.

---

## 1. Summary of Changes

### Automatic Flowchart Wrapping (Layout Engine)
*   **[bpmnXmlGenerator.ts](file:///d:/Code/antigravity/process-optimization/src/utils/bpmnXmlGenerator.ts) [MODIFY]**
    *   Added a layout wrapping detection step:
        *   Sets `MAX_COLS = 5` (max 5 shapes per row to fit perfectly inside A4 Landscape boundaries).
        *   If coordinates of a step would exceed column `4`, the engine wraps it to the next row (starts column index at `1`, reserving `0` for Catch Link Event).
    *   **Single-Process Stacked Lanes**:
        *   Instead of duplicating pools, we keep a single process pool but duplicate the lane sets vertically (e.g. `Lane_Role_${idx}_Row_${r}`) for each row stack.
        *   Lanes representing the same roles (Operator, Supervisor, etc.) are vertically stacked.
        *   The visual layout Y offset uses `yOffset = row * (totalHeight + rowSpacing)` to separate rows by a clear `80px` gap.
    *   **Synthesized Link Events (Off-Page Connectors)**:
        *   When a forward sequence flow crosses a row boundary (i.e. `rowA < rowB`), the engine synthesizes:
            *   `<bpmn:intermediateThrowEvent>` at column `5` (right edge) of the source row, labeled `L[1,2,3...]`.
            *   `<bpmn:intermediateCatchEvent>` at column `0` (left edge) of the target row in the target step's role lane, labeled with the same sequence name.
        *   Splits the flow so that `Source -> Throw Link` and `Catch Link -> Target` exist, but no sequence flow connector line connects the throwing and catching link events.
    *   **Perfect Margin Symmetry**:
        *   Calculates `maxColUsed` dynamically based on the actual maximum column index utilized in the layout (including link throw events).
        *   Scans the shapes in the last column to find their exact maximum right edge boundary (`maxRightEdge`), taking shape widths (events vs gateways vs tasks) into account.
        *   Computes pool width dynamically: `poolWidth = maxRightEdge - 68`. This ensures that the distance from the right edge of the last shape to the right boundary of the lanes matches the left margin of the lane (distance from left lane border to first shape left edge) **exactly (52px)**, providing perfect horizontal symmetry.
    *   **Approach B Synergy**:
        *   If the user has customized the layout and coordinates are saved (`hasCustomCoordinates` is true), the generator bypasses the wrapping algorithm and uses the manual coordinates directly to preserve user adjustments.
    *   **Page Labels**:
        *   Synthesizes a `<bpmn:textAnnotation>` on each page row labeled `Page [1, 2, 3...]` to visually chunk the canvas.

### Viewer Lockdown & Perfect Viewbox Fit-Width Scaling
*   **[BpmnViewerComponent.tsx](file:///d:/Code/antigravity/process-optimization/src/components/BpmnViewerComponent.tsx) [MODIFY]**
    *   Swapped `BpmnViewer` from `bpmn-js/lib/NavigatedViewer` to the base `bpmn-js/lib/Viewer`. This locks down the read-only view interface by disabling panning (mouse-dragging) and zoom (mouse-wheel scrolling).
    *   **Perfect 100% Fit-Width Scaling & Auto-Height Cutoff**:
        *   After importing the XML, the component queries the diagram's bounding box coordinates (`canvas.viewbox()`) at scale `1.0`.
        *   Computes the scale required to fit the flowchart width exactly to the page width: `scale = Math.min(1.0, containerWidth / (diagramWidth + 40))` (with `40px` horizontal padding, capped at `1.0` to prevent excessive zoom-in on tiny charts).
        *   Dynamically sets the DOM container height to `(diagramHeight + 50) * scale` to fit the diagram height perfectly, removing any unnecessary white space or scrollbars.
        *   Synchronously calls the viewbox setter `canvas.viewbox({ x, y, width, height })` to align the diagram exactly. This forces the BPMN SVG to expand and utilize 100% width of the card, and cuts off the card's height exactly at the bottom of the lanes.
    *   **Dashed Page Divider Lines**:
        *   Extracts lane positions from the BPMN XML. If the layout is wrapped, it appends SVG `<line>` elements with dashed stroke patterns between the row stacks directly into the SVG viewport group.

### Print Layout Margins
*   **[print.css](file:///d:/Code/antigravity/process-optimization/src/print.css) [MODIFY]**
    *   Prioritized the landscape option by modifying `@page` size to `A4 landscape` and margins to `10mm` to maximize the printable area for the horizontal wrapped rows.

### Interface Button Enhancements & Deletion Flow
*   **[Dashboard.tsx](file:///d:/Code/antigravity/process-optimization/src/components/Dashboard.tsx) [MODIFY]**
    *   Changed the **Open** button to **Icon only** by removing the "Open" text and utilizing the square small button format.
    *   Removed the **Delete** button and its handler from the process table row actions entirely. Now, each process card only lists two actions: **View** (Printer icon) and **Edit** (Pencil icon).
*   **[ProcessEditor.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessEditor.tsx) [MODIFY]**
    *   Imported `useAuth` to retrieve user permissions (`hasPermission`).
    *   Added a `handleDeleteProcess` handler that requests confirmation and triggers the DELETE API call (`/api/processes/${processId}`) on database storage before returning the user to the Dashboard.
    *   Relocated the **Delete Process** button to the top-right header panel of the Edit view (shown only when editing an existing process and if user has delete permission).

---

## 2. Verification & Testing

### Compilation
*   Run the production build: `npm run build`
    *   **Result:** Completed successfully. All chunks generated.

### Linting
*   Run code checks: `npm run lint`
    *   **Result:** Checked and verified. Clean (0 warnings, 0 errors).

### UI Layout Checks
1.  **Dashboard Rows**: Confirmed only two icon buttons appear (Printer and Pencil). The Open button is clean and text-free.
2.  **Edit Deletion**: Open Edit View on any process. Confirmed that the red "Delete Process" button appears in the top header panel. Clicked, confirmed, and verified it removes the process and navigates back to the Dashboard.
3.  **Perfect Scale**: Opened the Dashboard, loaded "Order Process" in view mode. The lanes expanded horizontally to occupy 100% of the page card width. The bottom boundary of the card is cut off exactly below the bottom of the lane lines, leaving zero wasted whitespace.
4.  **Tighter Symmetrical Margins**: Confirmed that the right margin of the lane (distance from right border to last element right edge) matches the left margin of the lane (distance from left border to first element left edge) **exactly (52px)**. Both margins are perfectly symmetrical.

---

## 3. Relax Step Shape Constraints & Reposition Add Step Button

### Relaxed Step Shapes
*   **[ProcessEditor.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessEditor.tsx) [MODIFY]**
    *   Modified `enforceStepShapes` to remove the automatic shape enforcement for the last step (index `stepsList.length - 1`), allowing any shape (Task, Exclusive Gateway, or End Event) to be configured for the final step.
    *   Enabled the standard BPMN Shape select dropdown for the final step in the checklist UI by removing the conditional check that was forcing a static/disabled "End" label for the last index. Now, only step index `0` remains locked to a "Start" event.

### Bottom Checklist Add Button
*   **[ProcessEditor.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessEditor.tsx) [MODIFY]**
    *   Repositioned and simplified the button to "+ Add step" at the very bottom of the checklist. It now renders unconditionally below the entire steps loop (`steps.map`) container.
    *   Updated `handleAddStep` to append the new task step directly to the end of the array: `setSteps(prev => enforceStepShapes([...prev, newStep]))` rather than splicing it before the last element.

---

## 4. Reposition Sequence Flow labels (Y/N) Closer to Gateway

### Near-Gateway Label Positioning
*   **[bpmnXmlGenerator.ts](file:///d:/Code/antigravity/process-optimization/src/utils/bpmnXmlGenerator.ts) [MODIFY]**
    *   Updated sequence flow DI rendering to collect waypoints in a temporary `edgeWaypoints` array.
    *   If a flow has a label (e.g. "Y" or "N"), the generator looks at the first segment between the first two waypoints ($P_0$ to $P_1$) to detect the exit direction.
    *   Calculates a label center point $cx, cy$ that is positioned exactly 18 pixels along that segment, and shifted 12 pixels perpendicular to the right-hand side (ensuring "N" sits above horizontal rightward flows and "Y" sits to the right of vertical downward flows).
    *   Appends a `<bpmndi:BPMNLabel>` element with dynamic bounding box coordinates based on the label length to center the text at the computed position.

---

## 5. Collision-Free Auto-Layout Connector Routing

### Offset Data Objects Layout
*   **[bpmnXmlGenerator.ts](file:///d:/Code/antigravity/process-optimization/src/utils/bpmnXmlGenerator.ts) [MODIFY]**
    *   Shifted data object coordinates to the top-right of their parent tasks: `doX = x + w - 18` and `doY = y - 60`. This centers the checksheet icon horizontally with the right edge of the task block, leaving the center vertical channel completely clear.
    *   Updated the data association edge DI waypoints to run diagonally from the top-right area of the task `(x + 85, y)` to the bottom center of the data object `(x + 110, y - 10)`.
    *   Adjusted the data object reference (`DataObjectRef`) label bounding box to `100px` width, `24px` height, and a vertical offset of `doY - 28` to support 2-line text labels with a safe `2px` gap from the document shape while keeping 1-line labels closer to the document icon (reducing the gap from `13px` to `9px`).

### Gutter Routing for Vertical Same-Column Flows
*   **[bpmnXmlGenerator.ts](file:///d:/Code/antigravity/process-optimization/src/utils/bpmnXmlGenerator.ts) [MODIFY]**
    *   Added a collision-detection check for vertically aligned sequence flows: if the source and target are in the same column, it scans for any intermediate step nodes situated between their row indices.
    *   If a collision is detected, the flow is routed through the **gutter** (the empty channel between columns) at `gutterX = Math.max(fromPos.x + fromPos.width, toPos.x + toPos.width) + 30`. Waypoints exit the right edge of the source, travel vertically down the gutter, and enter the right edge of the target shape.
    *   This completely prevents vertical flow lines from cutting through the middle of intermediate shapes while requiring exactly 2 right-angle bends (the minimal necessary bends).

---

## 6. Tabular Grid Layout for Step Checklist

### Spreadsheet-like Tabular Interface
*   **[ProcessEditor.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessEditor.tsx) [MODIFY]**
    *   Replaced the vertically stacked card design in the Workflow Builder tab with a structured grid-based table container using React CSS Grid (`grid-template-columns: 50px 1fr 180px 150px 180px 120px`).
    *   Added a stylized table header for columns: `#`, `Action Command (Verb + Noun + Target)*`, `Responsible Role`, `BPMN Shape`, `Connects to`, and `Actions`.
    *   Condensed each step block to a single, compact table row of `~45px` height, featuring horizontal borders and small inputs aligned side-by-side.

### Expandable & Inline Sub-rows
*   **[ProcessEditor.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessEditor.tsx) [MODIFY]**
    *   **Gateway Branches**: When a step's shape is set to Gateway (XOR), a nested, indented sub-row opens directly below with a left vertical primary-colored accent border (`4px solid var(--primary)`) and light background (`#f8fafc`). The Yes and No branch label inputs and target select dropdowns are rendered side-by-side inside this sub-row.
    *   **Task Checksheet Forms**: Added a compact inline checksheet option inside the Action column. If a task produces a form, the name input and deletion controls render directly beneath the main action input inside the same column.

### Hover Effects
*   **[index.css](file:///d:/Code/antigravity/process-optimization/src/index.css) [MODIFY]**
    *   Appended CSS hover transitions for `.step-table-row` to highlight the row background subtly (`#f8fafc`) on mouseover, enhancing spreadsheet scannability.

### Visual Separation of Steps
*   **[ProcessEditor.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessEditor.tsx) [MODIFY]**
    *   Encapsulated each step row (and its branch paths sub-row) inside its own distinct card box (border: 1px solid #cbd5e1, border-radius: 6px, box-shadow: 0 1px 2px rgba(0,0,0,0.05)) with a vertical separation margin (`marginBottom: 0.5rem`).
    *   This separates the steps visually while keeping them perfectly aligned under the table headers, eliminating the scrambled look and enhancing readability.

---

## 7. Reduced Visual Emphasis on Gateway Box & Delete Buttons

### Softer Gateway Configuration Box
*   **[ProcessEditor.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessEditor.tsx) [MODIFY]**
    *   Removed the uppercase "Branch Outlets (Decision Paths)" sub-header to reduce visual height and clutter.
    *   Matched the gateway config box background color to the card's background (`#ffffff`), blending it seamlessly.
    *   Replaced the dashed border with a very light solid line (`1px solid #f1f5f9`).
    *   Grouped the Yes/No branch options side-by-side with 24px-height inputs, centered labels, and light borders (`#e2e8f0`), making them look subordinate and clean.

### Soft Delete Buttons (Red on Hover only)
*   **[ProcessEditor.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessEditor.tsx) [MODIFY]**
    *   Converted the step checklist delete button and the checksheet form delete button to `step-delete-btn`.
    *   Changed the top-header "Delete Process" button from a bright solid red (`btn-danger`) block to a clean, secondary-styled outline button (`btn-outline-danger`).
*   **[index.css](file:///d:/Code/antigravity/process-optimization/src/index.css) [MODIFY]**
    *   Defined `.step-delete-btn` to use `opacity: 0.45` and a soft grey color by default, so it fades into the background and only becomes fully opaque (`opacity: 1`) and red on hover.
    *   Defined `.btn-outline-danger` to render as a neutral secondary button that transitions to a light-red background (`#fee2e2`), red border, and red text only on hover, letting the primary "Save" button stand out.


---

## 8. BPMN Diagram Monotone & Checklist Color Sync & Step Name Prominence

### BPMN Diagram Styling
*   **[bpmnXmlGenerator.ts](file:///d:/Code/antigravity/process-optimization/src/utils/bpmnXmlGenerator.ts) [MODIFY]**
    *   Removed custom color stroke and fill attributes from all `<bpmndi:BPMNShape>` and `<bpmndi:BPMNEdge>` elements, reverting the BPMN diagram shapes back to their default monotone styling (crisp black lines, white backgrounds).

### Checklist Builder Color Sync & Prominent Step Names
*   **[ProcessEditor.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessEditor.tsx) [MODIFY]**
    *   **Dynamic Left-Border Card Accents**: Configured step cards to dynamically render a colored left-border accent matching the shapes: Start is Emerald green (`#10b981`), Gateway is Amber gold (`#f59e0b`), End is Coral red (`#ef4444`), and Task is Teal (`#10a3a3`).
    *   **Emphasized Action Command Input (Step Name)**: Increased the step action text input size (`0.9rem`) and set its font-weight to `600` (semi-bold) so it becomes the row's visual anchor.
    *   **Muted Step Numbers**: Reduced the visual weight of step numbers (e.g. `#1`, `#2`) to a desaturated grey font (`var(--text-muted)`) and lightweight font weight (`500`), drawing the human eye directly to the action name rather than the index.
 
---

## 9. Downstream Layout Reset & Logical Flow Healing

### Logical Flow Healing (Sequence Adjustment)
*   **[ProcessEditor.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessEditor.tsx) [MODIFY]**
    *   Added `updateSequentialConnections` to analyze connections pre-mutation.
    *   If a step was using default sequential connections (i.e. targeting the old next step), we automatically update its target `nextStepId` to point to the new next step in the reordered array.
    *   Retains custom loops, backward targets, and gateway targets.

### Downstream Layout Reset (On Move & Deletion)
*   **[ProcessReader.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessReader.tsx) [MODIFY]**
    *   Simplified and condensed the SOP view attached form PDF layout to display both the Form Name and the File Name (wrapped in parentheses) on the same line (e.g. `Form Yêu cầu KH (TiepNhanDichVu.pdf)`), saving vertical card space.
*   **[ProcessEditor.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessEditor.tsx) [MODIFY]**
    *   **Move Up/Down**: When swapping steps at indices `index` and `targetIndex`, we find the start of the shift `minIdx = Math.min(index, targetIndex)`. All custom layout coordinates (`layoutX`, `layoutY`, `layoutWaypointsMap`, `layoutCatchWaypoints`, and label bounds) for steps from `minIdx` to the end of the process are cleared (set to `undefined`).
    *   **Delete Step**: When a step at `index` is removed, we clear custom layout coordinates for all remaining steps starting from `index` to the end of the array.
    *   **Upstream Waypoint Sweep**: Automatically sweeps all remaining upstream steps (index `< minIdx` or `< index`) and deletes any key in their `layoutWaypointsMap` pointing to any of the deleted or reset downstream steps.
*   **Result**: Eliminates overlapping shapes, crossed connections, and spaghetti lines when steps are inserted, reordered, or deleted in Custom Layout mode, allowing downstream shapes to reflow cleanly into auto-layout columns.

