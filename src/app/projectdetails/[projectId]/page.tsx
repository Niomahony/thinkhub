"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { TaskModal } from "~/app/_components/taskmodal";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import type { DropResult } from "react-beautiful-dnd";
import { useSession } from "next-auth/react";
import { ProjectDetailsPDF } from "~/app/_components/ProjectDetailsPDF";

if (typeof window !== "undefined" && !window.crypto.subtle.digest) {
  window.crypto.subtle.digest = async (algorithm, data) => {
    if (algorithm === "SHA-224") {
      console.warn("SHA-224 polyfill is being used. This is a placeholder implementation.");
      return new Uint8Array(28).buffer;
    }
    throw new Error("Unsupported algorithm");
  };
}

interface Task {
  id: number;
  title: string;
  description: string | null;
  createdBy: string;
  order: number;
}
interface Document {
  id: number;
  title: string;
  fileUrl: string | null;
}
const ProjectDetailsPage: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId ? Number(params.projectId) : null;
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [newDocumentUrl, setNewDocumentUrl] = useState("");
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<
    "Manager" | "Researcher" | "Viewer"
  >("Viewer");
  const [addMemberError, setAddMemberError] = useState("");
  const [memberToDelete, setMemberToDelete] = useState<{
    userId: string;
    email: string;
  } | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showMembers, setShowMembers] = useState(true);
  useEffect(() => {
    if (selectedTaskId !== null) {
      console.log("Selected Task ID:", selectedTaskId);
    }
  }, [selectedTaskId]);
  const {
    data: project,
    isLoading,
    error,
    refetch: refetchProject,
  } = api.project.getProjectDetails.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId },
  );
  const { data: milestones, refetch: refetchMilestones } =
    api.details.getMilestones.useQuery(
      { projectId: projectId! },
      { enabled: !!projectId },
    );
  const { data: documents, refetch: refetchDocuments } =
    api.project.getDocuments.useQuery(
      { projectId: projectId! },
      { enabled: !!projectId },
    );
  const { refetch: refetchUserId } = api.project.getUserIdByEmail.useQuery(
    { email: newMemberEmail },
    { enabled: false },
  );
  const updateTaskMutation = api.details.updateTask.useMutation({
    onSuccess: () => {
      void refetchMilestones();
    },
    onError: (error) => {
      console.error("Error updating task:", error);
      alert("Failed to update task. Please try again.");
    },
  });
  const deleteMemberMutation = api.project.deleteMember.useMutation({
    onSuccess: () => {
      void refetchProject();
    },
    onError: (error) => {
      console.error("Error deleting member:", error);
      alert("Failed to delete member. Please try again.");
    },
  });
  const addMemberMutation = api.project.addMember.useMutation({
    onSuccess: () => {
      setShowAddMemberModal(false);
      setNewMemberEmail("");
      setNewMemberRole("Viewer");
      void refetchProject();
    },
    onError: (error) => {
      setAddMemberError("Failed to add member. Please try again.");
      console.error("Error adding member:", error);
    },
  });
  const reorderTasksMutation = api.details.reorderTasks.useMutation({
    onSuccess: () => {
      void refetchMilestones();
    },
    onError: (error) => {
      console.error("Error reordering tasks:", error);
      alert("Failed to reorder tasks. Please try again.");
    },
  });
  const addMilestoneMutation = api.details.createMilestone.useMutation({
    onSuccess: () => {
      void refetchMilestones();
      setShowMilestoneModal(false);
    },
  });
  const addTaskMutation = api.details.createTask.useMutation({
    onSuccess: (data) => {
      void refetchMilestones();
      if (data) {
        setSelectedTaskId(data.id);
      }
    },
  });
  const addDocumentMutation = api.project.assignDocument.useMutation({
    onSuccess: () => {
      void refetchDocuments();
      setShowDocumentModal(false);
    },
  });
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDescription, setNewMilestoneDescription] = useState("");
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState("");
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [isMember, setIsMember] = useState<boolean | null>(null);
  useEffect(() => {
    if (status === "authenticated" && project && session) {
      console.log("Project Members:", project.members);
      const memberStatus = project.members.some(
        (member) => member.userId === session.user.id,
      );
      console.log("Is current user a member:", memberStatus);
      setIsMember(memberStatus);
    }
  }, [status, project, session]);
  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  if (error)
    return (
      <div className="flex h-screen items-center justify-center">
        Error: {error.message}
      </div>
    );
  if (!project)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-3xl font-bold">Project not found</h1>
          <button
            onClick={() => router.push("/homepage")}
            className="mt-4 rounded bg-blue-500 px-4 py-2 text-white"
          >
            Go to Home Page
          </button>
        </div>
      </div>
    );
  if (isMember === false) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-3xl font-bold">
            You are not a member of this project
          </h1>
          <p className="mb-4 text-lg">
            Please contact {project.creatorEmail} to be added to the project.
          </p>
          <button
            onClick={() => router.push("/homepage")}
            className="mt-4 rounded bg-blue-500 px-4 py-2 text-white"
          >
            Go to Home Page
          </button>
        </div>
      </div>
    );
  }
  const handleAddMilestone = () => {
    addMilestoneMutation.mutate({
      projectId: projectId!,
      title: newMilestoneTitle,
      description: newMilestoneDescription,
      dueDate: new Date(newMilestoneDueDate),
    });
  };
  const handleDeleteMember = () => {
    if (memberToDelete) {
      deleteMemberMutation.mutate(
        {
          projectId: projectId!,
          userId: memberToDelete.userId,
        },
        {
          onSuccess: () => {
            setShowDeleteConfirmation(false);
            setMemberToDelete(null);
            void refetchProject();
          },
          onError: (error) => {
            console.error("Error deleting member:", error);
            alert("Failed to delete member. Please try again.");
          },
        },
      );
    }
  };
  const handleAddMember = async () => {
    setAddMemberError("");

    const { data: preciseUser } = await refetchUserId();

    if (!preciseUser) {
      setAddMemberError("User not registered");
      return;
    }

    addMemberMutation.mutate(
      {
        projectId: projectId!,
        email: preciseUser.email, 
        role: newMemberRole,
      },
      {
        onSuccess: () => {
          setShowAddMemberModal(false);
          setNewMemberEmail("");
          setNewMemberRole("Viewer");
          void refetchProject();
        },
        onError: (error) => {
          setAddMemberError("Failed to add member. Please try again.");
          console.error("Error adding member:", error);
        },
      },
    );
  };

  const handleAddTask = (milestoneId: number, tasksCount: number) => {
    if (milestoneId !== null) {
      addTaskMutation.mutate(
        {
          projectId: projectId!,
          milestoneId,
          title: "",
          createdBy: project.createdBy,
          order: tasksCount,
        },
        {
          onSuccess: (data) => {
            if (data?.id) {
              setSelectedTaskId(data.id);
            }
            void refetchMilestones();
          },
        },
      );
    }
  };
  const handleAddDocument = () => {
    console.log("Document URL being sent:", newDocumentUrl);
    addDocumentMutation.mutate({
      title: newDocumentTitle,
      fileUrl: newDocumentUrl,
      projectId: projectId!,
    });
  };
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) {
      const milestone = milestones?.find(
        (m) => m.id.toString() === source.droppableId,
      );
      if (milestone) {
        const tasks = Array.from(milestone.tasks);
        const [movedTask] = tasks.splice(source.index, 1);
        if (movedTask) {
          tasks.splice(destination.index, 0, movedTask);
        }
        milestone.tasks = tasks;
        reorderTasksMutation.mutate({
          milestoneId: milestone.id,
          tasks: tasks.map((task) => task.id),
        });
      }
    } else {
      const destinationMilestoneId = parseInt(destination.droppableId);
      const taskId = parseInt(draggableId);
      updateTaskMutation.mutate({
        taskId,
        milestoneId: destinationMilestoneId,
      });
    }
  };
  return (
    <div className="container mx-auto p-4">
      <div className="mb-8 flex justify-between">
        <div className="w-1/4">
          <div className="mb-4 flex items-center">
            <h2 className="mr-2 text-xl font-semibold">Members</h2>
            {isMember &&
              session &&
              project.members.some(
                (member) =>
                  member.userId === session.user.id &&
                  member.role === "Manager",
              ) && (
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black text-black"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 3.75a.75.75 0 01.75.75v7.5h7.5a.75.75 0 010 1.5h-7.5v7.5a.75.75 0 01-1.5 0v-7.5H3.75a.75.75 0 010-1.5h7.5V4.5a.75.75 0 01.75-.75z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
          </div>
          {showMembers && (
            <ul>
              {project.members.map((member) => (
                <li
                  key={member.userId}
                  className="mb-2 flex items-center justify-between"
                >
                  <span>
                    {member.email} - {member.role}
                  </span>
                  {isMember &&
                    session &&
                    project.members.some(
                      (m) =>
                        m.userId === session.user.id && m.role === "Manager",
                    ) && (
                      <button
                        onClick={() => {
                          setMemberToDelete({
                            userId: member.userId,
                            email: member.email,
                          });
                          setShowDeleteConfirmation(true);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-red-500 text-red-500"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.5 12a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H5.25a.75.75 0 01-.75-.75z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="btn btn-secondary mt-2"
          >
            {showMembers ? "Hide Members" : "Show Members"}
          </button>
        </div>
        <div className="w-1/2 text-center">
          <h1 className="mb-2 text-3xl font-bold">{project?.name}</h1>
          <p className="mb-2 text-lg">{project?.description}</p>
          <p className="mb-2 text-sm text-gray-500">
            Created at:{" "}
            {project ? new Date(project.createdAt).toLocaleString() : ""}
          </p>
          <p className="text-sm text-gray-500">
            Creator Email: {project.creatorEmail}
          </p>

          {projectId && (
            <div className="mt-4">
              <ProjectDetailsPDF projectId={projectId} />
            </div>
          )}
        </div>
        <div className="w-1/4 text-right">
          <div className="mb-4 flex items-center justify-end">
            <h2 className="mr-2 text-xl font-semibold">Documents</h2>
            <button
              onClick={() => setShowDocumentModal(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black text-black"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M12 3.75a.75.75 0 01.75.75v7.5h7.5a.75.75 0 010 1.5h-7.5v7.5a.75.75 0 01-1.5 0v-7.5H3.75a.75.75 0 010-1.5h7.5V4.5a.75.75 0 01.75-.75z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          {showDocuments && (
            <ul className="mb-4 text-right">
              {documents?.map((doc: Document) => (
                <li key={doc.id} className="mb-2">
                  <a
                    href={doc.fileUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    {doc.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setShowDocuments(!showDocuments)}
            className="btn btn-secondary"
          >
            {showDocuments ? "Hide Documents" : "Show Documents"}
          </button>
        </div>
      </div>
      <div className="flex w-full flex-col items-center">
        <div className="mb-4 flex items-center">
          <h2 className="mr-2 text-2xl font-semibold">Milestones</h2>
          <button
            onClick={() => setShowMilestoneModal(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black text-black"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-8 w-8"
              style={{ transform: "translateY(-1px)" }}
            >
              <path
                fillRule="evenodd"
                d="M12 3.75a.75.75 0 01.75.75v7.5h7.5a.75.75 0 010 1.5h-7.5v7.5a.75.75 0 01-1.5 0v-7.5H3.75a.75.75 0 010-1.5h7.5V4.5a.75.75 0 01.75-.75z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="mt-4 flex justify-center gap-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            {milestones?.length ? (
              milestones.map((milestone, index) => (
                <Droppable
                  key={milestone.id}
                  droppableId={milestone.id.toString()}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[500px] w-64 p-4 ${snapshot.isDraggingOver ? "bg-blue-200" : "bg-gray-200"} rounded-lg shadow-md`}
                    >
                      <h3 className="mb-2 text-xl font-semibold">
                        Milestone {index + 1}
                      </h3>
                      <p className="mb-1 text-sm">
                        <strong>Title:</strong> {milestone.title}
                      </p>
                      <p className="mb-1 text-sm">
                        <strong>Description:</strong> {milestone.description}
                      </p>
                      <p className="mb-4 text-sm">
                        Due Date:{" "}
                        {new Date(milestone.dueDate).toLocaleDateString()}
                      </p>
                      <h4 className="mb-2 text-lg font-semibold">Tasks</h4>
                      <ul>
                        {milestone.tasks.map(
                          (task: Task, taskIndex: number) => (
                            <Draggable
                              key={task.id}
                              draggableId={task.id.toString()}
                              index={taskIndex}
                            >
                              {(provided, snapshot) => (
                                <li
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`mb-2 min-h-[50px] p-4 ${snapshot.isDragging ? "bg-blue-800" : "bg-blue-600"} rounded-lg text-white shadow-md`}
                                  onClick={() => setSelectedTaskId(task.id)}
                                >
                                  Task {taskIndex + 1}: {task.title}
                                </li>
                              )}
                            </Draggable>
                          ),
                        )}
                        {provided.placeholder}
                      </ul>
                      <button
                        onClick={() => {
                          handleAddTask(milestone.id, milestone.tasks.length);
                        }}
                        className="btn btn-secondary mt-2 w-full"
                      >
                        Add Task
                      </button>
                    </div>
                  )}
                </Droppable>
              ))
            ) : (
              <p>No milestones yet.</p>
            )}
          </DragDropContext>
        </div>
      </div>
      {showAddMemberModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          style={{
            backgroundColor: "#ffffff",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 2000 1500'%3E%3Cdefs%3E%3Crect stroke='%23ffffff' stroke-width='.5' width='1' height='1' id='s'/%3E%3Cpattern id='a' width='3' height='3' patternUnits='userSpaceOnUse' patternTransform='scale(50) translate(-980 -735)'%3E%3Cuse fill='%23fcfcfc' href='%23s' y='2'/%3E%3Cuse fill='%23fcfcfc' href='%23s' x='1' y='2'/%3E%3Cuse fill='%23fafafa' href='%23s' x='2' y='2'/%3E%3Cuse fill='%23fafafa' href='%23s'/%3E%3Cuse fill='%23f7f7f7' href='%23s' x='2'/%3E%3Cuse fill='%23f7f7f7' href='%23s' x='1' y='1'/%3E%3C/pattern%3E%3Cpattern id='b' width='7' height='11' patternUnits='userSpaceOnUse' patternTransform='scale(50) translate(-980 -735)'%3E%3Cg fill='%23f5f5f5'%3E%3Cuse href='%23s'/%3E%3Cuse href='%23s' y='5' /%3E%3Cuse href='%23s' x='1' y='10'/%3E%3Cuse href='%23s' x='2' y='1'/%3E%3Cuse href='%23s' x='2' y='4'/%3E%3Cuse href='%23s' x='3' y='8'/%3E%3Cuse href='%23s' x='4' y='3'/%3E%3Cuse href='%23s' x='4' y='7'/%3E%3Cuse href='%23s' x='5' y='2'/%3E%3Cuse href='%23s' x='5' y='6'/%3E%3Cuse href='%23s' x='6' y='9'/%3E%3C/g%3E%3C/pattern%3E%3C/defs%3E%3Crect fill='url(%23a)' width='100%25' height='100%25'/%3E%3Crect fill='url(%23b)' width='100%25' height='100%25'/%3E%3C/svg%3E\")",
            backgroundAttachment: "fixed",
            backgroundSize: "cover",
          }}
        >
          <div className="relative w-96 rounded-lg bg-white p-6">
            <span
              className="absolute right-2 top-2 cursor-pointer text-2xl"
              onClick={() => setShowAddMemberModal(false)}
            >
              &times;
            </span>
            <h2 className="mb-4 text-xl">Add Member</h2>
            <input
              type="email"
              placeholder="Member Email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="input input-bordered mb-4 w-full"
            />
            <select
              value={newMemberRole}
              onChange={(e) =>
                setNewMemberRole(
                  e.target.value as "Manager" | "Researcher" | "Viewer",
                )
              }
              className="input input-bordered mb-4 w-full"
            >
              <option value="Manager">Manager</option>
              <option value="Researcher">Researcher</option>
              <option value="Viewer">Viewer</option>
            </select>
            {addMemberError && (
              <p className="mb-4 text-red-500">{addMemberError}</p>
            )}
            <button
              onClick={handleAddMember}
              className="btn btn-primary w-full"
            >
              Submit
            </button>
          </div>
        </div>
      )}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="relative w-96 rounded-lg bg-white p-6">
            <span
              className="absolute right-2 top-2 cursor-pointer text-2xl"
              onClick={() => setShowMilestoneModal(false)}
            >
              &times;
            </span>
            <h2 className="mb-4 text-xl">Add Milestone</h2>
            <input
              type="text"
              placeholder="Milestone Title"
              value={newMilestoneTitle}
              onChange={(e) => setNewMilestoneTitle(e.target.value)}
              className="input input-bordered mb-4 w-full"
            />
            <input
              type="text"
              placeholder="Milestone Description"
              value={newMilestoneDescription}
              onChange={(e) => setNewMilestoneDescription(e.target.value)}
              className="input input-bordered mb-4 w-full"
            />
            <input
              type="date"
              placeholder="Milestone Due Date"
              value={newMilestoneDueDate}
              onChange={(e) => setNewMilestoneDueDate(e.target.value)}
              className="input input-bordered mb-4 w-full"
            />
            <button
              onClick={handleAddMilestone}
              className="btn btn-primary w-full"
            >
              Submit
            </button>
          </div>
        </div>
      )}
      {showDeleteConfirmation && memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="relative w-96 rounded-lg bg-white p-6">
            <span
              className="absolute right-2 top-2 cursor-pointer text-2xl"
              onClick={() => setShowDeleteConfirmation(false)}
            >
              &times;
            </span>
            <h2 className="mb-4 text-xl">Confirm Deletion</h2>
            <p>
              Are you sure you want to remove {memberToDelete.email} from the
              project?
            </p>
            <div className="mt-4 flex flex-col justify-end">
              <button
                onClick={handleDeleteMember}
                className="btn mb-2 bg-red-500 text-white"
              >
                Remove Member
              </button>
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showDocumentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="relative w-96 rounded-lg bg-white p-6">
            <span
              className="absolute right-2 top-2 cursor-pointer text-2xl"
              onClick={() => setShowDocumentModal(false)}
            >
              &times;
            </span>
            <h2 className="mb-4 text-xl">Add Document</h2>
            <input
              type="text"
              placeholder="Document Title"
              value={newDocumentTitle}
              onChange={(e) => setNewDocumentTitle(e.target.value)}
              className="input input-bordered mb-4 w-full"
            />
            <input
              type="text"
              placeholder="Document URL"
              value={newDocumentUrl}
              onChange={(e) => setNewDocumentUrl(e.target.value)}
              className="input input-bordered mb-4 w-full"
            />
            <button
              onClick={handleAddDocument}
              className="btn btn-primary w-full"
            >
              Submit
            </button>
          </div>
        </div>
      )}
      {selectedTaskId && (
        <TaskModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
};
export default ProjectDetailsPage;
